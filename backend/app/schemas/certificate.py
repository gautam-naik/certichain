from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class CertificateIssueRequest(BaseModel):
    student_name: str = Field(..., min_length=2, max_length=120)
    student_roll_number: str = Field(..., min_length=2, max_length=60)
    university_name: str = Field(..., min_length=2, max_length=160)
    degree: str = Field(..., min_length=2, max_length=160)
    department: str = Field(..., min_length=2, max_length=120)
    academic_year: str = Field(..., min_length=4, max_length=40)
    certificate_type: str = Field(..., min_length=2, max_length=80)
    grade: Optional[str] = Field(default="N/A", max_length=40)
    issue_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class VerifyByIdRequest(BaseModel):
    certificate_id: str
    source: str = "id"
    fields: Optional[dict] = None


class RevokeRequest(BaseModel):
    reason: Optional[str] = "Revoked by authorized administrator"
