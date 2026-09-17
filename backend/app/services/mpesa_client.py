"""
Thin wrapper around Safaricom Daraja API.

Two modes:
- Live   : if MPESA_CONSUMER_KEY + MPESA_CONSUMER_SECRET + MPESA_PASSKEY are set
- Sim    : otherwise, generates a realistic mock response so you can test.

To go live:
  1. Register on https://developer.safaricom.co.ke/
  2. Add credentials to .env
  3. Restart the server
"""
import base64
import requests
from datetime import datetime
from typing import Optional

from app.core.config import settings


SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
PROD_BASE = "https://api.safaricom.co.ke"


def _base_url() -> str:
    return SANDBOX_BASE if settings.MPESA_ENV == "sandbox" else PROD_BASE


def _credentials_available() -> bool:
    return bool(
        settings.MPESA_CONSUMER_KEY
        and settings.MPESA_CONSUMER_SECRET
        and settings.MPESA_PASSKEY
        and settings.MPESA_SHORTCODE
    )


def get_access_token() -> str:
    url = f"{_base_url()}/oauth/v1/generate?grant_type=client_credentials"
    resp = requests.get(
        url,
        auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}".encode()
    return base64.b64encode(raw).decode()


def stk_push(
    *,
    phone: str,
    amount: int,
    account_reference: str,
    description: str = "Invoice payment",
    callback_url: Optional[str] = None,
) -> dict:
    """Initiate STK Push. Returns raw Safaricom response (or simulation)."""
    if not _credentials_available():
        import uuid
        return {
            "simulation": True,
            "CheckoutRequestID": f"ws_CO_SIM_{uuid.uuid4().hex[:12].upper()}",
            "MerchantRequestID": f"sim-{uuid.uuid4().hex[:8]}",
            "ResponseCode": "0",
            "ResponseDescription": "Success. Request accepted for processing (SIMULATED)",
            "CustomerMessage": "Enter your M-Pesa PIN to complete the transaction (SIMULATED).",
            "AccountReference": account_reference,
            "Amount": amount,
            "PhoneNumber": phone,
        }

    token = get_access_token()
    timestamp = _timestamp()
    shortcode = settings.MPESA_SHORTCODE
    password = _stk_password(shortcode, settings.MPESA_PASSKEY, timestamp)

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url or settings.MPESA_CALLBACK_URL,
        "AccountReference": account_reference,
        "TransactionDesc": description,
    }

    url = f"{_base_url()}/mpesa/stkpush/v1/processrequest"
    resp = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    data = resp.json()
    data["simulation"] = False
    return data