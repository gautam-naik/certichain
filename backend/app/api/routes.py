import base64
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pypdf import PdfReader
from sqlalchemy.orm import Session
import io

from app.blockchain.service import BlockchainService
from app.core.database import get_db
from app.core.security import create_access_token, get_optional_admin, require_admin, verify_password
from app.models.certificate import Certificate, User, VerificationLog
from app.schemas.certificate import (
    CertificateIssueRequest,
    LoginRequest,
    RevokeRequest,
    VerifyByIdRequest,
)
from app.services.pdf_service import META_PREFIX, generate_certificate_pdf, generate_qr_png
from app.utils.crypto import compute_canonical_hash, compute_file_sha256, generate_certificate_id

router = APIRouter(prefix="/api")
blockchain_service = BlockchainService()


def _serialize(cert: Certificate, is_admin: bool) -> dict:
    return {
        "certificate_id": cert.certificate_id,
        "student_name": cert.student_name,
        "student_roll_number": cert.student_roll_number if is_admin else None,
        "university_name": cert.university_name,
        "degree": cert.degree,
        "department": cert.department,
        "academic_year": cert.academic_year,
        "certificate_type": cert.certificate_type,
        "grade": cert.grade if is_admin else None,
        "issue_date": cert.issue_date,
        "canonical_hash": cert.canonical_hash,
        "pdf_sha256": cert.pdf_sha256,
        "tx_hash": cert.tx_hash,
        "block_number": cert.block_number,
        "network_name": cert.network_name,
        "issuer_address": cert.issuer_address,
        "revoked": cert.revoked,
        "revoked_at": cert.revoked_at,
        "revoked_reason": cert.revoked_reason,
        "created_at": cert.created_at,
    }


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.name, "role": user.role})
    return {"token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}


@router.post("/auth/logout")
def logout():
    return {"message": "Logged out successfully."}


@router.get("/auth/me")
def me(user=Depends(require_admin)):
    return {"user": user}


@router.post("/certificates", status_code=201)
def issue_certificate(body: CertificateIssueRequest, db: Session = Depends(get_db), _user=Depends(require_admin)):
    cert_id = generate_certificate_id(body.issue_date)
    while db.query(Certificate).filter(Certificate.certificate_id == cert_id).first():
        cert_id = generate_certificate_id(body.issue_date)

    payload = body.model_dump()
    payload["certificate_id"] = cert_id
    canonical_hash = compute_canonical_hash(payload)

    tx_info = blockchain_service.register_certificate(cert_id, canonical_hash)
    pdf_bytes = generate_certificate_pdf({**payload, "canonical_hash": canonical_hash, "tx_hash": tx_info["tx_hash"]})
    pdf_sha = compute_file_sha256(pdf_bytes)

    record = Certificate(
        certificate_id=cert_id,
        student_name=body.student_name.strip(),
        student_roll_number=body.student_roll_number.strip(),
        university_name=body.university_name.strip(),
        degree=body.degree.strip(),
        department=body.department.strip(),
        academic_year=body.academic_year.strip(),
        certificate_type=body.certificate_type.strip(),
        grade=(body.grade or "N/A").strip(),
        issue_date=body.issue_date,
        canonical_hash=canonical_hash,
        pdf_sha256=pdf_sha,
        tx_hash=tx_info["tx_hash"],
        block_number=tx_info["block_number"],
        network_name=tx_info["network_name"],
        issuer_address=tx_info["issuer_address"],
        ledger_mode="ethereum-rpc",
        revoked=False,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"certificate": _serialize(record, True), "message": "Certificate issued and anchored."}


@router.get("/certificates")
def list_certificates(q: str = "", status: str = "", page: int = 1, limit: int = 12, db: Session = Depends(get_db), user=Depends(get_optional_admin)):
    query = db.query(Certificate)
    if status == "active":
        query = query.filter(Certificate.revoked.is_(False))
    elif status == "revoked":
        query = query.filter(Certificate.revoked.is_(True))
    rows = query.order_by(Certificate.id.desc()).all()
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in f"{r.certificate_id} {r.student_name} {r.degree} {r.university_name}".lower()]
    total = len(rows)
    start = max(0, (page - 1) * limit)
    return {"items": [_serialize(r, bool(user)) for r in rows[start : start + limit]], "total": total, "page": page, "limit": limit}


@router.get("/certificates/{certificate_id}")
def get_certificate(certificate_id: str, db: Session = Depends(get_db), user=Depends(get_optional_admin)):
    cert = db.query(Certificate).filter(Certificate.certificate_id == certificate_id.upper()).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    return {"certificate": _serialize(cert, bool(user))}


@router.get("/certificates/{certificate_id}/pdf")
def download_pdf(certificate_id: str, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.certificate_id == certificate_id.upper()).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    pdf_bytes = generate_certificate_pdf(_serialize(cert, True))
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{cert.certificate_id}.pdf"'})


@router.get("/certificates/{certificate_id}/qr")
def download_qr(certificate_id: str, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.certificate_id == certificate_id.upper()).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    return Response(content=generate_qr_png(cert.certificate_id), media_type="image/png")


@router.post("/certificates/{certificate_id}/revoke")
def revoke_certificate(certificate_id: str, body: RevokeRequest, db: Session = Depends(get_db), _user=Depends(require_admin)):
    cert = db.query(Certificate).filter(Certificate.certificate_id == certificate_id.upper()).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    if cert.revoked:
        raise HTTPException(status_code=409, detail="Certificate already revoked.")
    tx_hash = blockchain_service.revoke_certificate(cert.certificate_id)
    cert.revoked = True
    cert.revoked_at = datetime.now(timezone.utc).isoformat()
    cert.revoked_reason = body.reason
    db.commit()
    return {"message": "Certificate revoked on blockchain.", "certificate_id": cert.certificate_id, "tx_hash": tx_hash}


@router.post("/verify/id")
def verify_by_id(body: VerifyByIdRequest, db: Session = Depends(get_db)):
    cid = body.certificate_id.strip().upper()
    cert = db.query(Certificate).filter(Certificate.certificate_id == cid).first()
    candidate_hash = "0x" + ("0" * 64)
    if cert:
        payload = {
            "certificate_id": cert.certificate_id,
            "student_name": (body.fields or {}).get("student_name", cert.student_name),
            "student_roll_number": (body.fields or {}).get("student_roll_number", cert.student_roll_number),
            "university_name": (body.fields or {}).get("university_name", cert.university_name),
            "degree": (body.fields or {}).get("degree", cert.degree),
            "department": (body.fields or {}).get("department", cert.department),
            "academic_year": (body.fields or {}).get("academic_year", cert.academic_year),
            "certificate_type": (body.fields or {}).get("certificate_type", cert.certificate_type),
            "grade": (body.fields or {}).get("grade", cert.grade),
            "issue_date": (body.fields or {}).get("issue_date", cert.issue_date),
        }
        candidate_hash = compute_canonical_hash(payload)

    chain = blockchain_service.verify_certificate(cid, candidate_hash)
    if not chain["exists"]:
        result = "NOT_FOUND"
    elif chain["revoked"]:
        result = "REVOKED"
    elif not cert or not chain["hash_matches"]:
        result = "TAMPERED"
    else:
        result = "AUTHENTIC"

    db.add(VerificationLog(certificate_id=cid, verification_result=result, request_type=body.source, status_detail=f"Verified via {body.source}", created_at=datetime.now(timezone.utc).isoformat()))
    db.commit()
    return {"result": result, "certificate_id": cid, "hash_comparison": {"submitted_hash": candidate_hash, "matches": chain["hash_matches"]}}


@router.post("/verify/upload")
async def verify_upload(file: UploadFile = File(...), certificate_id: str = Form(default=""), db: Session = Depends(get_db)):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit.")
    extracted = None
    if raw.startswith(b"%PDF-"):
        reader = PdfReader(io.BytesIO(raw))
        keywords = (reader.metadata or {}).get("/Keywords", "")
        for part in str(keywords).split():
            if part.startswith(META_PREFIX):
                extracted = json.loads(base64.b64decode(part[len(META_PREFIX):]).decode("utf-8"))
    elif raw.lstrip().startswith(b"{"):
        try:
            parsed = json.loads(raw.decode("utf-8"))
            if isinstance(parsed, dict) and parsed.get("certificate_id"):
                extracted = parsed
        except Exception:
            pass
    cid = (extracted.get("certificate_id") if extracted else certificate_id).strip().upper()
    candidate_hash = compute_canonical_hash(extracted) if (extracted and extracted.get("student_name")) else compute_file_sha256(raw)
    chain = blockchain_service.verify_certificate(cid, candidate_hash)
    result = "NOT_FOUND" if not chain["exists"] else "REVOKED" if chain["revoked"] else "AUTHENTIC" if chain["hash_matches"] else "TAMPERED"
    db.add(VerificationLog(certificate_id=cid or "UNKNOWN", verification_result=result, request_type="upload", status_detail=f"File upload verification ({file.filename})", created_at=datetime.now(timezone.utc).isoformat()))
    db.commit()
    return {"result": result, "certificate_id": cid, "uploaded_file_sha256": compute_file_sha256(raw)}


@router.get("/verify/history")
def verification_history(limit: int = 50, db: Session = Depends(get_db), _user=Depends(require_admin)):
    rows = db.query(VerificationLog).order_by(VerificationLog.id.desc()).limit(min(200, limit)).all()
    return {"items": [{"id": r.id, "certificate_id": r.certificate_id, "verification_result": r.verification_result, "request_type": r.request_type, "status_detail": r.status_detail, "created_at": r.created_at} for r in rows]}


@router.get("/blockchain/status")
def blockchain_status():
    return blockchain_service.get_status()
