import hashlib
import json
import re
import secrets
from typing import Optional
from web3 import Web3


def _clean(val: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (val or "").strip())


def normalize_certificate_data(payload: dict) -> str:
    canonical = {
        "academic_year": _clean(payload.get("academic_year")),
        "certificate_id": _clean(payload.get("certificate_id")).upper(),
        "certificate_type": _clean(payload.get("certificate_type")),
        "degree": _clean(payload.get("degree")),
        "department": _clean(payload.get("department")),
        "grade": _clean(payload.get("grade") or "N/A"),
        "issue_date": _clean(payload.get("issue_date")),
        "student_name": _clean(payload.get("student_name")),
        "student_roll_number": _clean(payload.get("student_roll_number")).upper(),
        "university_name": _clean(payload.get("university_name")),
    }
    return json.dumps(canonical, separators=(",", ":"), sort_keys=True)


def compute_canonical_hash(payload: dict) -> str:
    normalized = normalize_certificate_data(payload)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"0x{digest}"


def compute_file_sha256(raw_bytes: bytes) -> str:
    return f"0x{hashlib.sha256(raw_bytes).hexdigest()}"


def compute_certificate_id_hash(certificate_id: str) -> str:
    return Web3.solidity_keccak(["string"], [certificate_id.strip().upper()]).hex()


def generate_certificate_id(issue_date: Optional[str] = None) -> str:
    year = issue_date[:4] if issue_date and re.match(r"^\d{4}", issue_date) else "2026"
    suffix = secrets.token_hex(3).upper()
    return f"CERT-{year}-{suffix}"
