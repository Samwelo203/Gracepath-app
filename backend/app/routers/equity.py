from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
import secrets

from app.db.session import get_db
from app.core.config import settings
from app.models.invoice import Invoice
from app.models.mpesa import MpesaTransaction
from app.schemas.equity import EquityPushRequest
from app.services import billing_service, payment_service, equity_service

router = APIRouter(prefix="/api/payments/equity", tags=["Equity Payments"])


@router.post("/stk-push")
def initiate_equitel_push(payload: EquityPushRequest, db: Session = Depends(get_db)):
    inv = billing_service.get_invoice_by_number(db, payload.invoice_number)
    amount = Decimal(payload.amount)
    if amount > Decimal(inv.balance):
        raise HTTPException(400, "Amount exceeds the outstanding invoice balance")
    try:
        phone = equity_service.normalize_mobile_number(payload.phone)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    try:
        reference = equity_service.make_payment_reference(inv.account_reference)
    except ValueError as exc:
        raise HTTPException(500, "Invoice has an invalid Equity account reference") from exc
    tx = MpesaTransaction(
        transaction_id=reference,
        invoice_id=inv.id,
        invoice_number=inv.invoice_number,
        amount=amount,
        payer_phone=phone,
        account_reference=inv.invoice_number,
        result_desc="Equitel STK prompt requested",
        status="pending",
    )
    db.add(tx)
    db.commit()

    try:
        result = equity_service.initiate_equitel_push(phone, amount, reference)
    except equity_service.EquityGatewayError as exc:
        tx.status = "failed"
        tx.result_desc = str(exc)[:200]
        db.commit()
        raise HTTPException(502, str(exc)) from exc

    tx.result_code = str(result.get("code", ""))[:10]
    tx.result_desc = str(result.get("message", "Prompt accepted"))[:200]
    tx.raw_payload = {"equity_response": result}
    db.commit()
    return {
        "payment_reference": reference,
        "message": "Equity accepted the prompt. Check the Equitel phone and enter your PIN there.",
    }


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


@router.post("/push-callback/{callback_token}")
async def equity_push_callback(
    callback_token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    if not settings.EQUITY_PUSH_CALLBACK_TOKEN or not secrets.compare_digest(
        callback_token, settings.EQUITY_PUSH_CALLBACK_TOKEN
    ):
        raise HTTPException(401, "Invalid Equity callback token")

    body = await request.json()
    reference = body.get("transactionReference") or body.get("reference")
    if not reference:
        raise HTTPException(400, "Missing Equity transaction reference")

    tx = (
        db.query(MpesaTransaction)
        .filter(MpesaTransaction.transaction_id == str(reference))
        .with_for_update()
        .first()
    )
    if not tx:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}
    if tx.status == "success":
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    code = str(body.get("code", ""))
    tx.result_code = code[:10]
    tx.result_desc = str(body.get("message", "Equity payment callback"))[:200]
    tx.raw_payload = body

    if code == "3" and body.get("status") is True:
        try:
            paid_amount = Decimal(str(body.get("requestAmount")))
            if (
                not paid_amount.is_finite()
                or paid_amount <= 0
                or paid_amount != paid_amount.quantize(Decimal("0.01"))
                or paid_amount > Decimal("9999999999.99")
            ):
                raise ValueError("Invalid callback amount")
            callback_phone = equity_service.normalize_mobile_number(
                str(body.get("mobileNumber", ""))
            )
        except (ValueError, ArithmeticError):
            tx.status = "unmatched"
            tx.invoice_id = None
        else:
            inv = db.query(Invoice).filter(Invoice.id == tx.invoice_id).first()
            if (
                paid_amount != Decimal(tx.amount)
                or callback_phone != tx.payer_phone
                or body.get("currency") != "KES"
                or not inv
                or paid_amount > Decimal(inv.balance)
            ):
                tx.status = "unmatched"
                tx.invoice_id = None
                tx.amount = paid_amount
                tx.payer_phone = callback_phone
                tx.result_desc = "Equity callback details do not match the pending payment"
            else:
                tx.status = "success"
                tx.payer_phone = callback_phone
                billing_service.apply_payment(db, inv.id, paid_amount)
    elif code not in {"0", "2"}:
        tx.status = "failed"

    db.commit()
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