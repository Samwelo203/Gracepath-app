#!/bin/bash
# patch_auth.sh — adds auth dependencies to existing routers

cd "$(dirname "$0")"

# ---- PATIENT ----
python << 'PYEOF'
path = "app/routers/patient.py"
src = open(path).read()
if "require_staff" not in src:
    src = src.replace(
        "from app.services import patient_service",
        "from app.services import patient_service\n"
        "from app.core.security import require_staff, require_clinical\n"
        "from app.models.user import User"
    )
    src = src.replace(
        "def register_patient(payload: PatientCreate, db: Session = Depends(get_db)):",
        "def register_patient(payload: PatientCreate, db: Session = Depends(get_db),\n"
        "                     user: User = Depends(require_staff)):"
    )
    src = src.replace(
        "    patient_id: int, payload: PatientUpdate, db: Session = Depends(get_db)\n):",
        "    patient_id: int, payload: PatientUpdate, db: Session = Depends(get_db),\n"
        "    user: User = Depends(require_staff),\n):"
    )
    src = src.replace(
        "def delete_patient(patient_id: int, db: Session = Depends(get_db)):",
        "def delete_patient(patient_id: int, db: Session = Depends(get_db),\n"
        "                    user: User = Depends(require_staff)):"
    )
    src = src.replace(
        "    q: Optional[str] = None,\n    db: Session = Depends(get_db),\n):",
        "    q: Optional[str] = None,\n    db: Session = Depends(get_db),\n    user: User = Depends(require_clinical),\n):"
    )
    src = src.replace(
        "def get_patient(patient_id: int, db: Session = Depends(get_db)):",
        "def get_patient(patient_id: int, db: Session = Depends(get_db),\n"
        "                 user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "def get_patient_by_number(patient_number: str, db: Session = Depends(get_db)):",
        "def get_patient_by_number(patient_number: str, db: Session = Depends(get_db),\n"
        "                            user: User = Depends(require_clinical)):"
    )
    open(path, "w").write(src)
    print("✅ patient")
else:
    print("ℹ️  patient already patched")
PYEOF

# ---- BED ----
python << 'PYEOF'
path = "app/routers/bed.py"
src = open(path).read()
if "require_staff" not in src:
    src = src.replace(
        "from app.services import bed_service",
        "from app.services import bed_service\n"
        "from app.core.security import require_admin, require_clinical\n"
        "from app.models.user import User"
    )
    src = src.replace(
        "def create_bed(payload: BedCreate, db: Session = Depends(get_db)):",
        "def create_bed(payload: BedCreate, db: Session = Depends(get_db),\n"
        "                user: User = Depends(require_admin)):"
    )
    src = src.replace(
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n):",
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_clinical),\n):"
    )
    src = src.replace(
        "def bed_stats(db: Session = Depends(get_db)):",
        "def bed_stats(db: Session = Depends(get_db),\n"
        "               user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "def get_bed(bed_id: int, db: Session = Depends(get_db)):",
        "def get_bed(bed_id: int, db: Session = Depends(get_db),\n"
        "             user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "def get_bed_by_number(bed_number: str, db: Session = Depends(get_db)):",
        "def get_bed_by_number(bed_number: str, db: Session = Depends(get_db),\n"
        "                       user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "def update_bed(bed_id: int, payload: BedUpdate, db: Session = Depends(get_db)):",
        "def update_bed(bed_id: int, payload: BedUpdate, db: Session = Depends(get_db),\n"
        "                user: User = Depends(require_admin)):"
    )
    src = src.replace(
        "def delete_bed(bed_id: int, db: Session = Depends(get_db)):",
        "def delete_bed(bed_id: int, db: Session = Depends(get_db),\n"
        "                user: User = Depends(require_admin)):"
    )
    open(path, "w").write(src)
    print("✅ bed")
else:
    print("ℹ️  bed already patched")
PYEOF

# ---- ADMISSION ----
python << 'PYEOF'
path = "app/routers/admission.py"
src = open(path).read()
if "require_staff" not in src:
    src = src.replace(
        "from app.services import admission_service as svc",
        "from app.services import admission_service as svc\n"
        "from app.core.security import require_staff, require_clinical\n"
        "from app.models.user import User"
    )
    src = src.replace(
        "def create_admission(payload: AdmissionCreate, db: Session = Depends(get_db)):",
        "def create_admission(payload: AdmissionCreate, db: Session = Depends(get_db),\n"
        "                       user: User = Depends(require_staff)):"
    )
    src = src.replace(
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n):\n    return svc.list_admissions",
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_clinical),\n):\n    return svc.list_admissions"
    )
    src = src.replace(
        "def get_admission(admission_id: int, db: Session = Depends(get_db)):",
        "def get_admission(admission_id: int, db: Session = Depends(get_db),\n"
        "                    user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "    notes: Optional[str] = None,\n    db: Session = Depends(get_db),\n):\n    \"\"\"Assign a bed",
        "    notes: Optional[str] = None,\n    db: Session = Depends(get_db),\n    user: User = Depends(require_staff),\n):\n    \"\"\"Assign a bed"
    )
    src = src.replace(
        "    payload: BedTransferRequest,\n    db: Session = Depends(get_db),\n):",
        "    payload: BedTransferRequest,\n    db: Session = Depends(get_db),\n    user: User = Depends(require_staff),\n):"
    )
    src = src.replace(
        "def current_bed(admission_id: int, db: Session = Depends(get_db)):",
        "def current_bed(admission_id: int, db: Session = Depends(get_db),\n"
        "                  user: User = Depends(require_clinical)):"
    )
    src = src.replace(
        "    payload: DischargeRequest = DischargeRequest(),\n    db: Session = Depends(get_db),\n):",
        "    payload: DischargeRequest = DischargeRequest(),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_staff),\n):"
    )
    src = src.replace(
        "def bed_history(bed_id: int, db: Session = Depends(get_db)):",
        "def bed_history(bed_id: int, db: Session = Depends(get_db),\n"
        "                 user: User = Depends(require_clinical)):"
    )
    open(path, "w").write(src)
    print("✅ admission")
else:
    print("ℹ️  admission already patched")
PYEOF

# ---- INVOICE ----
python << 'PYEOF'
path = "app/routers/invoice.py"
src = open(path).read()
if "require_accounts" not in src:
    src = src.replace(
        "from app.services import billing_service as svc",
        "from app.services import billing_service as svc\n"
        "from app.core.security import require_accounts, require_clinical\n"
        "from app.models.user import User"
    )
    src = src.replace(
        "def stats(db: Session = Depends(get_db)):",
        "def stats(db: Session = Depends(get_db),\n"
        "           user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "def create_invoice(payload: InvoiceFromAdmission, db: Session = Depends(get_db)):",
        "def create_invoice(payload: InvoiceFromAdmission, db: Session = Depends(get_db),\n"
        "                     user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n):\n    return svc.list_invoices",
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_accounts),\n):\n    return svc.list_invoices"
    )
    src = src.replace(
        "def get_invoice(invoice_id: int, db: Session = Depends(get_db)):",
        "def get_invoice(invoice_id: int, db: Session = Depends(get_db),\n"
        "                  user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "def get_invoice_by_number(invoice_number: str, db: Session = Depends(get_db)):",
        "def get_invoice_by_number(invoice_number: str, db: Session = Depends(get_db),\n"
        "                            user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "def add_charge(invoice_id: int, payload: ManualCharge, db: Session = Depends(get_db)):",
        "def add_charge(invoice_id: int, payload: ManualCharge, db: Session = Depends(get_db),\n"
        "                user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "def delete_item(invoice_id: int, item_id: int, db: Session = Depends(get_db)):",
        "def delete_item(invoice_id: int, item_id: int, db: Session = Depends(get_db),\n"
        "                 user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "    billing_policy: str = Query(\"24hr\"),\n    db: Session = Depends(get_db),\n):",
        "    billing_policy: str = Query(\"24hr\"),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_accounts),\n):"
    )
    open(path, "w").write(src)
    print("✅ invoice")
else:
    print("ℹ️  invoice already patched")
PYEOF

# ---- PAYMENT ----
python << 'PYEOF'
path = "app/routers/payment.py"
src = open(path).read()
if "require_accounts" not in src:
    src = src.replace(
        "from app.services import payment_service, mpesa_client, billing_service",
        "from app.services import payment_service, mpesa_client, billing_service\n"
        "from app.core.security import require_accounts\n"
        "from app.models.user import User"
    )
    src = src.replace(
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n):\n    return payment_service.list_transactions",
        "    limit: int = Query(200, le=1000),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_accounts),\n):\n    return payment_service.list_transactions"
    )
    src = src.replace(
        "def get_transaction(tx_id: int, db: Session = Depends(get_db)):",
        "def get_transaction(tx_id: int, db: Session = Depends(get_db),\n"
        "                     user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "def unmatched(db: Session = Depends(get_db)):",
        "def unmatched(db: Session = Depends(get_db),\n"
        "               user: User = Depends(require_accounts)):"
    )
    src = src.replace(
        "    invoice_number: str = Query(...),\n    db: Session = Depends(get_db),\n):\n    return payment_service.link_unmatched_to_invoice",
        "    invoice_number: str = Query(...),\n    db: Session = Depends(get_db),\n    user: User = Depends(require_accounts),\n):\n    return payment_service.link_unmatched_to_invoice"
    )
    open(path, "w").write(src)
    print("✅ payment")
else:
    print("ℹ️  payment already patched")
PYEOF

echo ""
echo "✅ Router patching complete"