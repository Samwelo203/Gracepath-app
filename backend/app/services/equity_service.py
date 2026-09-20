"""
Equity Jenga IPN (Instant Payment Notification) service.

When a payer dials *334# and pays to Paybill 247247 (Equity) using one of
our generated account references (e.g. "A7K2M"), Equity sends a POST
callback to our /api/payments/equity/callback endpoint.

Payload format (per Jenga docs):
{
  "callbackType": "IPN",
  "transaction": {
    "billNumber": "A7K2M",       <- the 5-char code we generated
    "amount": "3000",
    "reference": "ED990222",      <- M-Pesa receipt
    "status": "SUCCESS",
    ...
  },
  "customer": {
    "name": "Mary Otieno",
    "mobileNumber": "254799888777",
    ...
  }
}
"""
from decimal import Decimal
from typing import Optional

from app.core.config import settings


def _verify_auth(auth_header: Optional[str]) -> bool:
    """
    Verify Basic Auth header sent by Equity.
    Format: "Basic base64(username:password)"
    """
    import base64
    if not auth_header or not auth_header.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(auth_header[6:]).decode()
        user, passwd = decoded.split(":", 1)
    except Exception:
        return False

    return (
        user == settings.EQUITY_IPN_USER
        and passwd == settings.EQUITY_IPN_PASS
    )


def parse_ipn_payload(body: dict) -> dict:
    """
    Extract the fields we care about from the Jenga IPN payload.
    Returns a normalised dict.
    """
    tx = body.get("transaction", {})
    cust = body.get("customer", {})

    return {
        "account_reference": (tx.get("billNumber") or "").strip().upper(),
        "amount": Decimal(str(tx.get("amount", "0"))),
        "receipt": tx.get("reference") or tx.get("transactionId"),
        "status": (tx.get("status") or "").upper(),
        "payer_name": cust.get("name"),
        "payer_phone": cust.get("mobileNumber"),
        "raw": body,
    }