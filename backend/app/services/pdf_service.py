import base64
import io
import json
import qrcode
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.core.config import settings

META_PREFIX = "CERTICHAIN_CANONICAL_V1:"


def generate_qr_png(certificate_id: str) -> bytes:
    verify_url = f"{settings.APP_URL.rstrip('/')}/verify?id={certificate_id}"
    img = qrcode.make(verify_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_certificate_pdf(cert: dict) -> bytes:
    buf = io.BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))

    canonical_payload = {
        "certificate_id": cert["certificate_id"],
        "student_name": cert["student_name"],
        "student_roll_number": cert["student_roll_number"],
        "university_name": cert["university_name"],
        "degree": cert["degree"],
        "department": cert["department"],
        "academic_year": cert["academic_year"],
        "certificate_type": cert["certificate_type"],
        "grade": cert.get("grade") or "N/A",
        "issue_date": cert["issue_date"],
    }
    encoded_meta = base64.b64encode(json.dumps(canonical_payload).encode("utf-8")).decode("ascii")
    c.setTitle(f"CertiChain Academic Certificate - {cert['certificate_id']}")
    c.setAuthor(cert["university_name"])
    c.setSubject(f"Certificate ID {cert['certificate_id']}")
    c.setKeywords(f"{META_PREFIX}{encoded_meta}")

    c.setFillColorRGB(0.04, 0.08, 0.16)
    c.rect(10 * mm, height - 36 * mm, width - 20 * mm, 26 * mm, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(16 * mm, height - 22 * mm, cert["university_name"].upper())
    c.setFillColorRGB(0.36, 0.85, 0.78)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(16 * mm, height - 29 * mm, "OFFICIAL BLOCKCHAIN-VERIFIED ACADEMIC CREDENTIAL")

    c.setFillColorRGB(0.06, 0.1, 0.18)
    c.setFont("Times-Bold", 26)
    c.drawString(16 * mm, height - 66 * mm, cert["student_name"])

    c.setFont("Helvetica", 12)
    c.drawString(16 * mm, height - 82 * mm, f"Roll Number: {cert['student_roll_number']} | Year: {cert['academic_year']}")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(16 * mm, height - 98 * mm, cert["degree"])
    c.setFont("Helvetica", 12)
    c.drawString(16 * mm, height - 108 * mm, f"Department of {cert['department']} | Grade: {cert.get('grade', 'N/A')}")

    c.setFont("Courier", 9)
    c.drawString(16 * mm, 32 * mm, f"Certificate ID: {cert['certificate_id']} | Issue Date: {cert['issue_date']}")
    c.drawString(16 * mm, 25 * mm, f"SHA-256 Digest: {cert['canonical_hash']}")
    c.drawString(16 * mm, 18 * mm, f"Tx Reference:   {cert['tx_hash']}")

    qr_bytes = generate_qr_png(cert["certificate_id"])
    qr_reader = ImageReader(io.BytesIO(qr_bytes))
    c.drawImage(qr_reader, width - 52 * mm, 18 * mm, width=36 * mm, height=36 * mm)

    c.showPage()
    c.save()
    return buf.getvalue()
