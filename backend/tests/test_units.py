import pytest

from app.core import security
from app.schemas.auth import RegisterRequest
from app.services.application_service import generate_application_number
from app.services.experience_service import derive_total_experience_months, format_experience
from app.services.job_service import _next_requisition_id


class TestPasswordSecurity:
    def test_hash_and_verify(self):
        hashed = security.hash_password("Secret@123")
        assert hashed != "Secret@123"
        assert security.verify_password("Secret@123", hashed)
        assert not security.verify_password("Wrong@123", hashed)

    def test_invalid_hash_returns_false(self):
        assert security.verify_password("x", "not-a-hash") is False

    @pytest.mark.parametrize(
        "bad_password",
        ["Sh0rt", "nodigitsatall", "12345678"],
    )
    def test_register_rejects_weak_passwords(self, bad_password):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RegisterRequest(
                first_name="A",
                last_name="B",
                email="weak@test.local",
                password=bad_password,
            )


class TestTokens:
    def test_access_token_roundtrip(self):
        token = security.create_access_token("user-1", "CANDIDATE")
        payload = security.decode_token(token, expected_type=security.ACCESS_TOKEN_TYPE)
        assert payload["sub"] == "user-1"
        assert payload["role"] == "CANDIDATE"
        assert payload["type"] == "access"

    def test_wrong_type_rejected(self):
        token = security.create_access_token("user-1", "ADMIN")
        with pytest.raises(ValueError):
            security.decode_token(token, expected_type=security.REFRESH_TOKEN_TYPE)

    def test_expired_token_rejected(self):
        from datetime import timedelta

        token = security._create_token("u", "ADMIN", "access", timedelta(seconds=-10))
        import jwt as pyjwt

        with pytest.raises(pyjwt.ExpiredSignatureError):
            security.decode_token(token)

    def test_tampered_token_rejected(self):
        token = security.create_access_token("u", "ADMIN")
        with pytest.raises(Exception):
            security.decode_token(token + "x")


class TestRequisitionIds:
    def test_first_id_for_year(self):
        rid = _next_requisition_id(set())
        year = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).year
        assert rid == f"REQ-{year}-00001"

    def test_increments_max_sequence(self):
        rid = _next_requisition_id({"REQ-2030-00001", "REQ-2030-00007", "REQ-2029-00042"})
        year = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).year
        assert rid == f"REQ-{year}-00001"

    def test_ignores_malformed_ids(self):
        rid = _next_requisition_id({"REQ-2030-GARBAGE"})
        year = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).year
        assert rid == f"REQ-{year}-00001"


class TestApplicationNumber:
    def test_format(self):
        number = generate_application_number()
        import re

        assert re.fullmatch(r"APP-\d{8}-[0-9A-F]{6}", number)


class TestExperience:
    def _exp(self, start, end=None, currently=False):
        class E:
            pass

        e = E()
        e.start_date = start
        e.end_date = end
        e.currently_working = currently
        return e

    def test_fixed_range(self):
        import datetime as dt

        months = derive_total_experience_months(
            [self._exp(dt.date(2018, 7, 1), dt.date(2024, 6, 30))]
        )
        # ~2163 days -> 72 months
        assert 70 <= months <= 73

    def test_currently_working_counts_to_today(self):
        import datetime as dt

        one_year_ago = dt.date.today() - dt.timedelta(days=365)
        months = derive_total_experience_months([self._exp(one_year_ago, currently=True)])
        assert 12 <= months <= 14

    def test_multiple_entries_summed(self):
        import datetime as dt

        entries = [
            self._exp(dt.date(2018, 1, 1), dt.date(2019, 1, 1)),
            self._exp(dt.date(2019, 1, 1), dt.date(2020, 1, 1)),
        ]
        assert derive_total_experience_months(entries) == 24

    def test_end_before_start_clamped(self):
        import datetime as dt

        entries = [self._exp(dt.date(2020, 5, 1), dt.date(2020, 1, 1))]
        assert derive_total_experience_months(entries) == 0

    def test_format_experience(self):
        assert format_experience(0) == "Fresher"
        assert format_experience(12) == "1 yr"
        assert format_experience(7) == "7 mo"
        assert format_experience(30) == "2 yr 6 mo"
