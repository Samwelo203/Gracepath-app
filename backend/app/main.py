from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from pathlib import Path

from app.core.config import settings
from app.db.session import Base, engine

from app.models import (  # noqa: F401
    Patient, CodeSequence, Bed, Admission, BedAssignment,
    Invoice, InvoiceItem, MpesaTransaction, User,
    PatientNote,
)

from app.routers import patient, bed, admission, invoice, payment, auth, equity


Base.metadata.create_all(bind=engine)


def _migrate_invoice_admission_nullable():
    """Allow invoices for registered patients who have no admission."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import text
    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(invoices)")).fetchall()
        admission = next((column for column in columns if column[1] == "admission_id"), None)
        if not admission or not admission[3]:
            return
        connection.execute(text("ALTER TABLE invoices RENAME TO invoices_legacy"))
        connection.execute(text("""
            CREATE TABLE invoices (
                id INTEGER NOT NULL PRIMARY KEY,
                invoice_number VARCHAR(30) NOT NULL,
                admission_id INTEGER,
                patient_id INTEGER NOT NULL,
                subtotal NUMERIC(12, 2) NOT NULL,
                total_amount NUMERIC(12, 2) NOT NULL,
                amount_paid NUMERIC(12, 2) NOT NULL,
                balance NUMERIC(12, 2) NOT NULL,
                status VARCHAR(20) NOT NULL,
                issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                due_date DATE,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                account_reference VARCHAR(5) NOT NULL
            )
        """))
        connection.execute(text("""
            INSERT INTO invoices
            SELECT id, invoice_number, admission_id, patient_id, subtotal, total_amount,
                   amount_paid, balance, status, issued_at, due_date, notes,
                   created_at, updated_at, account_reference
            FROM invoices_legacy
        """))
        connection.execute(text("CREATE UNIQUE INDEX ix_invoices_invoice_number ON invoices (invoice_number)"))
        connection.execute(text("CREATE INDEX ix_invoices_id ON invoices (id)"))
        connection.execute(text("CREATE INDEX ix_invoices_admission_id ON invoices (admission_id)"))
        connection.execute(text("CREATE INDEX ix_invoices_patient_id ON invoices (patient_id)"))
        connection.execute(text("CREATE INDEX ix_invoices_status ON invoices (status)"))
        connection.execute(text("CREATE UNIQUE INDEX ix_invoices_account_reference ON invoices (account_reference)"))
        connection.execute(text("DROP TABLE invoices_legacy"))


_migrate_invoice_admission_nullable()


def _migrate_patient_clinical_fields():
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    with engine.begin() as connection:
        patient_columns = {
            column["name"] for column in inspect(connection).get_columns("patients")
        }
        note_columns = {
            column["name"] for column in inspect(connection).get_columns("patient_notes")
        }
        if "assigned_clinician_id" not in patient_columns:
            connection.execute(text(
                "ALTER TABLE patients ADD COLUMN assigned_clinician_id INTEGER "
                "REFERENCES users(id)"
            ))
            connection.execute(text(
                "CREATE INDEX ix_patients_assigned_clinician_id "
                "ON patients (assigned_clinician_id)"
            ))
        if "review" not in note_columns:
            connection.execute(text("ALTER TABLE patient_notes ADD COLUMN review TEXT"))
        if "follow_up_date" not in note_columns:
            connection.execute(text(
                "ALTER TABLE patient_notes ADD COLUMN follow_up_date DATE"
            ))


_migrate_patient_clinical_fields()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Patient admission, bed management, billing and M-Pesa payments.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Project paths
# =========================================================
# backend/app/main.py → ../../.. = project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public"     # payer portal
DIST_DIR = PROJECT_ROOT / "frontend" / "dist"         # built React app


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# =========================================================
# API routes
# =========================================================
app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(bed.router)
app.include_router(admission.router)
app.include_router(invoice.router)
app.include_router(payment.router)
app.include_router(equity.router)


# =========================================================
# Health + root
# =========================================================
@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "staff_dashboard": "/app/",
        "payer_portal": "/pay/payment.html",
        "api_docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.get("/logo.png", include_in_schema=False)
def logo_png():
    logo_path = PUBLIC_DIR / "logo.png"
    if not logo_path.exists():
        raise StarletteHTTPException(status_code=404, detail="Logo not found")
    return FileResponse(logo_path)


@app.get("/favicon.svg", include_in_schema=False)
def favicon_svg():
    icon_path = PUBLIC_DIR / "favicon.svg"
    if not icon_path.exists():
        raise StarletteHTTPException(status_code=404, detail="Favicon not found")
    return FileResponse(icon_path)


@app.get("/favicon.ico", include_in_schema=False)
def favicon_ico():
    icon_path = PUBLIC_DIR / "favicon.svg"
    if not icon_path.exists():
        raise StarletteHTTPException(status_code=404, detail="Favicon not found")
    return FileResponse(icon_path)


# =========================================================
# Payload portal redirects
# =========================================================
@app.get("/pay", include_in_schema=False)
def pay_redirect():
    return RedirectResponse("/pay/payment.html")


# =========================================================
# Static mounts
# =========================================================
# Payer portal (frontend/public/)
if PUBLIC_DIR.exists():
    app.mount(
        "/pay",
        StaticFiles(directory=str(PUBLIC_DIR), html=True),
        name="pay",
    )
    print(f"[static] /pay  ->  {PUBLIC_DIR}")
else:
    print(f"[static] WARNING: {PUBLIC_DIR} not found")


# React staff dashboard (frontend/dist/)
if DIST_DIR.exists():
    app.mount(
        "/app",
        SPAStaticFiles(directory=str(DIST_DIR), html=True),
        name="app",
    )
    print(f"[static] /app  ->  {DIST_DIR}")
else:
    print(f"[static] WARNING: {DIST_DIR} not found — run `npm run build` in frontend/")


# Redirect /app (no trailing slash) → /app/
@app.get("/app", include_in_schema=False)
def app_redirect():
    return RedirectResponse("/app/")


# SPA fallback: any /app/* route that isn't a real file returns index.html
# so React Router handles it (needed for direct URL access to /app/invoices/5 etc.)
@app.get("/app/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return RedirectResponse("/")


# =========================================================
# Startup — seed default admin
# =========================================================
@app.on_event("startup")
def _seed():
    from app.db.session import SessionLocal
    from app.services import auth_service
    db = SessionLocal()
    try:
        auth_service.ensure_default_admin(db)
    finally:
        db.close()