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