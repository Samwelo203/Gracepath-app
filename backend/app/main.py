from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(bed.router)
app.include_router(admission.router)
app.include_router(invoice.router)
app.include_router(payment.router)


@app.on_event("startup")
def _seed():
    """Create default admin on first startup."""
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
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}