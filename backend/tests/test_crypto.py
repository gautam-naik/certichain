from app.utils.crypto import compute_canonical_hash, normalize_certificate_data


def test_canonical_hash_detects_single_character_tampering():
    base = {
        "certificate_id": "CERT-2026-PY0001",
        "student_name": "Ananya Rao",
        "student_roll_number": "CS2201",
        "university_name": "CertiChain Demo University",
        "degree": "B.Tech CS",
        "department": "Computer Science",
        "academic_year": "2022-2026",
        "certificate_type": "Degree Certificate",
        "grade": "9.40 CGPA",
        "issue_date": "2026-06-15",
    }
    h1 = compute_canonical_hash(base)
    h2 = compute_canonical_hash({**base, "grade": "9.41 CGPA"})
    assert h1 != h2
    assert len(h1) == 66
    assert "CERT-2026-PY0001" in normalize_certificate_data(base)
