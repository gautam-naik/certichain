from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    role = Column(String(32), default="admin", nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(String(64), unique=True, nullable=False, index=True)
    student_name = Column(String(120), nullable=False)
    student_roll_number = Column(String(60), nullable=False)
    university_name = Column(String(160), nullable=False)
    degree = Column(String(160), nullable=False)
    department = Column(String(120), nullable=False)
    academic_year = Column(String(40), nullable=False)
    certificate_type = Column(String(80), nullable=False)
    grade = Column(String(40), default="N/A", nullable=False)
    issue_date = Column(String(20), nullable=False)
    canonical_hash = Column(String(66), nullable=False)
    pdf_sha256 = Column(String(66), default="", nullable=False)
    tx_hash = Column(String(66), nullable=False)
    block_number = Column(Integer, default=0, nullable=False)
    network_name = Column(String(120), nullable=False)
    issuer_address = Column(String(64), nullable=False)
    ledger_mode = Column(String(32), default="demo", nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(String(40), nullable=True)
    revoked_reason = Column(Text, nullable=True)
    created_at = Column(String(40), nullable=False)


class VerificationLog(Base):
    __tablename__ = "verification_logs"
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(String(64), nullable=False, index=True)
    verification_result = Column(String(32), nullable=False)
    request_type = Column(String(16), nullable=False)
    status_detail = Column(String(255), nullable=False)
    created_at = Column(String(40), nullable=False)
