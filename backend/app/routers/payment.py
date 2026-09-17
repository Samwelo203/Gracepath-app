from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal

from app.db.session import get_db
from app.schemas.mpesa import (
    STKPushRequest, STKPushResponse, MpesaTransactionRead, SimulationCallback,
)
from app.services import payment_service, mpesa_client, billing_service

router = APIRouter(prefix="/api/payments/mpesa", tags=["M-Pesa Payments"])


# ---------- STK Push ----------
@router.post("/stkpush", response_model=STKPushResponse)
def stk_push(payload: STKPushRequest, db: Session = Depends(get_db)):
    """
    Initiate an STK Push for an invoice.
    The payer receives a PIN prompt on their phone.
    """
    inv = billing_service.get_invoice_by_number(db, payload.invoice_number)

    amount = payload.amount or inv.balance
    if amount <= 0:
        return STKPushResponse(
            customer_message="Invoice has no outstanding balance.",
            simulation=mpesa_client._credentials_available() is False,
        )

    # Normalize phone: 07XXXXXXXX -> 2547XXXXXXXX
    phone = payload.phone.strip().replace(" ", "").replace("+", "")
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if not phone.startswith("254"):
        return STKPushResponse(
            customer_message="Phone must start with 254 or 07.",
            simulation=False,
        )

    result = mpesa_client.stk_push(
        phone=phone,
        amount=int(amount),
        account_reference=inv.invoice_number,
        description=f"Payment for {inv.invoice_number}",
    )

    return STKPushResponse(
        checkout_request_id=result.get("CheckoutRequestID"),
        merchant_request_id=result.get("MerchantRequestID"),
        customer_message=result.get("CustomerMessage"),
        simulation=result.get("simulation", False),
        raw=result,
    )


# ---------- Real Safaricom callback ----------
@router.post("/callback")
async def mpesa_callback(request: Request, db: Session = Depends(get_db)):
    """
    Safaricom posts here when a transaction completes.
    Endpoint must be publicly reachable over HTTPS.
    """
    body = await request.json()
    stk = body.get("Body", {}).get("stkCallback", {})
    result_code = str(stk.get("ResultCode", ""))
    result_desc = stk.get("ResultDesc", "")

    if result_code != "0":
        payment_service.record_failed_payment(
            db,
            transaction_id=None,
            account_reference=None,
            amount=None,
            payer_phone=None,
            result_code=result_code,
            result_desc=result_desc,
            raw_payload=body,
        )
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    items = stk.get("CallbackMetadata", {}).get("Item", [])
    meta = {item["Name"]: item.get("Value") for item in items}

    receipt = meta.get("MpesaReceiptNumber")
    amount = Decimal(str(meta.get("Amount", 0)))
    phone = str(meta.get("PhoneNumber", ""))
    account_reference = stk.get("AccountReference") or meta.get("AccountReference")

    payment_service.record_successful_payment(
        db,
        transaction_id=receipt,
        amount=amount,
        account_reference=account_reference,
        payer_name=None,
        payer_phone=phone,
        raw_payload=body,
        result_code=result_code,
        result_desc=result_desc,
    )
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


# ---------- Simulation callback (testing) ----------
@router.post("/simulate-callback", response_model=MpesaTransactionRead)
def simulate_callback(payload: SimulationCallback, db: Session = Depends(get_db)):
    """
    Test the callback path end-to-end without Safaricom.
    Equivalent to: Safaricom posts a successful payment for this invoice.
    """
    tx = payment_service.record_successful_payment(
        db,
        transaction_id=payload.mpesa_receipt,
        amount=payload.amount,
        account_reference=payload.invoice_number,
        payer_name=payload.payer_name,
        payer_phone=payload.payer_phone,
        raw_payload={"simulated": True, "payload": payload.model_dump(mode="json")},
    )
    return tx


# ---------- List / inspect ----------
@router.get("/transactions", response_model=List[MpesaTransactionRead])
def list_transactions(
    status_filter: Optional[str] = Query(None, alias="status"),
    invoice_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
):
    return payment_service.list_transactions(db, status_filter, invoice_id, skip, limit)


@router.get("/transactions/{tx_id}", response_model=MpesaTransactionRead)
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    return payment_service.get_transaction(db, tx_id)


# ---------- Unmatched queue ----------
@router.get("/unmatched", response_model=List[MpesaTransactionRead])
def unmatched(db: Session = Depends(get_db)):
    return payment_service.list_unmatched(db)


@router.post("/unmatched/{tx_id}/link", response_model=MpesaTransactionRead)
def link_unmatched(
    tx_id: int,
    invoice_number: str = Query(...),
    db: Session = Depends(get_db),
):
    return payment_service.link_unmatched_to_invoice(db, tx_id, invoice_number)