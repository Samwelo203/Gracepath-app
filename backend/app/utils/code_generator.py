"""
System-generated codes for Grace Path Centre.

All functions take the sequence-assigned integer and format it
into the human-readable code shown on invoices, receipts, and screens.
"""
from datetime import datetime

import secrets
import string

def generate_account_reference() -> str:
    """
    Generate a 5-character uppercase code for use as the M-Pesa account number.
    Format: 3 letters + 2 digits (e.g. 'A7K2M', 'B9X4P')
    """
    letters = ''.join(secrets.choice(string.ascii_uppercase) for _ in range(3))
    digits = ''.join(secrets.choice(string.digits) for _ in range(2))
    # Shuffle so it's not always AAA11
    chars = list(letters + digits)
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def generate_patient_number(seq: int) -> str:
    return f"GPC-{seq:06d}"


def generate_admission_number(seq: int, year: int | None = None) -> str:
    year = year or datetime.now().year
    return f"ADM-{year}-{seq:06d}"


def generate_bed_number(seq: int) -> str:
    return f"B-{seq:03d}"


def generate_invoice_number(seq: int, year: int | None = None) -> str:
    year = year or datetime.now().year
    return f"INV-{year}-{seq:06d}"


def generate_payment_reference(seq: int, year: int | None = None) -> str:
    year = year or datetime.now().year
    return f"PAY-{year}-{seq:06d}"


def generate_assignment_number(seq: int) -> str:
    return f"BA-{seq:06d}"