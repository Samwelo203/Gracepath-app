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
from datetime import date
import base64
import os
import re
import secrets
from typing import Optional
from urllib.parse import urlsplit

import requests
from app.core.config import settings


class EquityGatewayError(Exception):
    pass


def normalize_mobile_number(value: str) -> str:
    phone = re.sub(r"[\s()+-]", "", value)
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    elif len(phone) == 9 and phone[0] in "17":
        phone = "254" + phone
    if not re.fullmatch(r"254[17]\d{8}", phone):
        raise ValueError("Enter a valid Kenyan mobile number, such as 0712345678.")
    return phone


def make_payment_reference(account_reference: str) -> str:
    prefix = account_reference.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{5}", prefix):
        raise ValueError("Invoice account reference must be exactly five letters or digits.")
    suffix = "".join(secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(7))
    return prefix + suffix


def _jenga_urls() -> tuple[str, str]:
    if settings.EQUITY_ENV.lower() == "sandbox":
        return (
            "https://uat.finserve.africa/authentication/api/v3/authenticate/merchant",
            "https://uat.finserve.africa/v3-apis/payment-api/v3.0/stkussdpush/initiate",
        )
    return (
        "https://api.finserve.africa/authentication/api/v3/authenticate/merchant",
        "https://api.finserve.africa/v3-apis/payment-api/v3.0/stkussdpush/initiate",
    )


def initiate_equitel_push(phone: str, amount: Decimal, reference: str) -> dict:
    required = {
        "EQUITY_MERCHANT_CODE": settings.EQUITY_MERCHANT_CODE,
        "EQUITY_CONSUMER_SECRET": settings.EQUITY_CONSUMER_SECRET,
        "EQUITY_API_KEY": settings.EQUITY_API_KEY,
        "EQUITY_ACCOUNT_NUMBER": settings.EQUITY_ACCOUNT_NUMBER,
        "EQUITY_PUSH_CALLBACK_URL": settings.EQUITY_PUSH_CALLBACK_URL,
        "EQUITY_PUSH_CALLBACK_TOKEN": settings.EQUITY_PUSH_CALLBACK_TOKEN,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise EquityGatewayError(
            "Equity push is not configured. Set: " + ", ".join(missing)
        )
    account_number = settings.EQUITY_ACCOUNT_NUMBER.strip()
    if not account_number.isascii() or not account_number.isdigit():
        raise EquityGatewayError(
            "EQUITY_ACCOUNT_NUMBER must be the numeric Equity receiving account number; "
            "it must not be the merchant code or invoice account reference."
        )
    if not re.fullmatch(r"[A-Z0-9]{6,12}", reference):
        raise EquityGatewayError("Equity payment reference must be 6 to 12 letters or digits.")
    callback = urlsplit(settings.EQUITY_PUSH_CALLBACK_URL)
    callback_suffix = "/push-callback/" + settings.EQUITY_PUSH_CALLBACK_TOKEN
    if callback.scheme != "https" or not callback.netloc or not callback.path.rstrip("/").endswith(callback_suffix):
        raise EquityGatewayError(
            "EQUITY_PUSH_CALLBACK_URL must be a public HTTPS URL ending in "
            "/api/payments/equity" + callback_suffix
        )

    token_url, push_url = _jenga_urls()
    headers = {"Api-Key": settings.EQUITY_API_KEY, "Content-Type": "application/json"}
    try:
        token_response = requests.post(
            token_url,
            headers=headers,
            json={
                "merchantCode": settings.EQUITY_MERCHANT_CODE,
                "consumerSecret": settings.EQUITY_CONSUMER_SECRET,
            },
            timeout=15,
        )
        token_response.raise_for_status()
        token = token_response.json().get("accessToken")
    except (requests.RequestException, ValueError) as exc:
        raise EquityGatewayError("Could not authenticate with Equity Jenga.") from exc
    if not token:
        raise EquityGatewayError("Equity Jenga did not return an access token.")

    amount_text = format(Decimal(amount), ".2f")
    payload = {
        "merchant": {
            "accountNumber": account_number,
            "countryCode": "KE",
            "name": settings.EQUITY_MERCHANT_NAME,
        },
        "payment": {
            "ref": reference,
            "amount": amount_text,
            "currency": "KES",
            "telco": "Equitel",
            "mobileNumber": phone,
            "date": date.today().isoformat(),
            "callBackUrl": settings.EQUITY_PUSH_CALLBACK_URL,
            "pushType": "STK",
        },
    }
    signed_text = "".join((
        account_number,
        reference,
        phone,
        "Equitel",
        amount_text,
        "KES",
    ))
    try:
        from Crypto.Hash import SHA256
        from Crypto.PublicKey import RSA
        from Crypto.Signature import PKCS1_v1_5

        key_path = os.path.expanduser(settings.EQUITY_PRIVATE_KEY_PATH)
        with open(key_path, "rb") as key_file:
            private_key = RSA.import_key(key_file.read())
        signature = base64.b64encode(
            PKCS1_v1_5.new(private_key).sign(SHA256.new(signed_text.encode("utf-8")))
        ).decode("ascii")
    except (OSError, ValueError, TypeError) as exc:
        raise EquityGatewayError("The Equity signing key is unavailable or invalid.") from exc

    try:
        response = requests.post(
            push_url,
            headers={
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json",
                "Signature": signature,
            },
            json=payload,
            timeout=20,
        )
        response_data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise EquityGatewayError("Could not reach Equity's payment service.") from exc

    if not response.ok or str(response_data.get("code")) != "-1":
        message = response_data.get("message") or "Equity did not accept the payment prompt."
        raise EquityGatewayError(message)
    return response_data


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