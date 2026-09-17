from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pathlib import Path

from app.core.config import settings
from app.db.session import Base, engine

from app.models import (  # noqa: F401
    Patient, CodeSequence, Bed, Admission, BedAssignment,
    Invoice, InvoiceItem, MpesaTransaction, User,
)

from app.routers import patient, bed, admission, invoice, payment, auth


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Patient admission, bed management, billing and M-Pesa payments.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # same origin now, so this is only for external tools
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- API routes ----------
app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(bed.router)
app.include_router(admission.router)
app.include_router(invoice.router)
app.include_router(payment.router)


# ---------- Static frontend ----------
# Path:  backend/app/main.py -> ../../.. -> project root -> frontend/public
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public"

@app.get("/pay")
def pay_redirect():
    return RedirectResponse("/pay/payment.html")

if PUBLIC_DIR.exists():
    app.mount(
        "/pay",
        StaticFiles(directory=str(PUBLIC_DIR), html=True),
        name="pay",
    )
    print(f"[static] Serving /pay from {PUBLIC_DIR}")
else:
    print(f"[static] WARNING: {PUBLIC_DIR} not found — /pay will be 404")


@app.on_event("startup")
def _seed():
    from app.db.session import SessionLocal
    from app.services import auth_service
    db = SessionLocal()
    try:
        auth_service.ensure_default_admin(db)
    finally:
        db.close()


@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "payment_page": "/pay/payment.html",
        "api_docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}