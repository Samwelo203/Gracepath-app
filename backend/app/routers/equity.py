from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.db.session import get_db
from app.models.invoice import Invoice
from app.services import payment_service, equity_service

router = APIRouter(prefix="/api/payments/equity", tags=["Equity Payments"])


@router.post("/callback")
async def equity_callback(request: Request, db: Session = Depends(get_db)):
    """
    Receives IPN from Equity Jenga when a payment hits the bank account.
    Equity sends Basic Auth in the Authorization header.
    """
    # 1. Verify Basic Auth
    auth = request.headers.get("Authorization")
    if not equity_service._verify_auth(auth):
        raise HTTPException(401, "Invalid Equity IPN credentials")

    # 2. Parse payload
    body = await request.json()
    data = equity_service.parse_ipn_payload(body)

    # 3. Only process successful payments
    if data["status"] != "SUCCESS":
        # Queue failed payment for audit
        payment_service.record_failed_payment(
            db,
            transaction_id=data["receipt"],
            account_reference=data["account_reference"],
            amount=data["amount"],
            payer_phone=data["payer_phone"],
            result_code=data["status"],
            result_desc="Equity IPN non-success",
            raw_payload=data["raw"],
        )
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    # 4. Try to match the 5-char account_reference to an invoice
    inv = None
    if data["account_reference"]:
        inv = (
            db.query(Invoice)
            .filter(Invoice.account_reference == data["account_reference"])
            .first()
        )

    # 5. Record the payment (matched or unmatched)
    payment_service.record_successful_payment(
        db,
        transaction_id=data["receipt"] or f"EQUITY-{data['account_reference']}",
        amount=data["amount"],
        account_reference=inv.invoice_number if inv else data["account_reference"],
        payer_name=data["payer_name"],
        payer_phone=data["payer_phone"],
        raw_payload=data["raw"],
        result_code="0",
        result_desc="Equity IPN",
    )

    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/payment-instructions/{invoice_number}")
def payment_instructions(invoice_number: str, db: Session = Depends(get_db)):
    """
    Public endpoint: returns the payment instructions a payer needs.
    Used by the payer portal to show the 5-char code.
    """
    inv = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == invoice_number)
        .first()
    )
    if not inv:
        raise HTTPException(404, "Invoice not found")

    from app.core.config import settings
    return {
        "invoice_number": inv.invoice_number,
        "paybill": settings.EQUITY_PAYBILL,
        "account_number": inv.account_reference,
        "amount_due": str(inv.balance),
        "instructions": (
            f"1. Dial *334#\n"
            f"2. Choose Pay Bill\n"
            f"3. Business Number: {settings.EQUITY_PAYBILL}\n"
            f"4. Account Number: {inv.account_reference}\n"
            f"5. Amount: KSh {inv.balance}\n"
            f"6. Enter your M-Pesa PIN"
        ),
    }