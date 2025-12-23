import requests

BASE_EMAIL_URL = "https://synapstorebackend.vercel.app/api/v1/email"


def send_storeowner_dispatch_email(
    *,
    to_email: str,
    store_name: str,
    supplier_name: str,
    invoice_id: str,
    items: dict,
    expected_delivery: str,
):
    payload = {
        "to_email": to_email,
        "store_name": store_name,
        "supplier_name": supplier_name,
        "invoice_id": invoice_id,
        "items": items,
        "expected_delivery": expected_delivery,
    }

    resp = requests.post(
        f"{BASE_EMAIL_URL}/storeowner-dispatch",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )

    resp.raise_for_status()


def send_supplier_failure_email(
    *,
    to_email: str,
    store_name: str,
    store_email: str,
    supplier_name: str,
    invoice_id: str,
    failure_reason: str,
):
    payload = {
        "to_email": to_email,
        "store_name": store_name,
        "store_email": store_email,
        "supplier_name": supplier_name,
        "invoice_id": invoice_id,
        "failure_reason": failure_reason,
    }

    resp = requests.post(
        f"{BASE_EMAIL_URL}/supplier-delivery-failed",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=10,
    )

    resp.raise_for_status()
