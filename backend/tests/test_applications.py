import io

from tests.conftest import (
    TINY_PDF,
    application_payload,
    create_published_job,
    make_admin,
    make_candidate,
    submit_application,
)


def _apply(client, job_id, cand_headers, **payload_overrides):
    payload = application_payload(**payload_overrides)
    return submit_application(
        client, cand_headers, job_id, payload=payload, resume=TINY_PDF
    )


class TestSubmission:
    def test_happy_path(self, client):
        job, _admin = create_published_job(client)
        cand_headers, email, _t = make_candidate(client)

        response = _apply(client, job["id"], cand_headers)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["application_number"].startswith("APP-")
        assert body["status"] == "NEW"
        assert body["job_id"] == job["id"]

        # My Applications shows it
        mine = client.get("/api/v1/candidate/applications", headers=cand_headers).json()
        assert mine["total"] == 1
        assert mine["items"][0]["job_title"] == job["title"]

        # Master profile was upserted for future pre-fill (FR-AUTH-07)
        profile = client.get("/api/v1/candidate/profile", headers=cand_headers).json()
        assert profile["current_location"] == "Bengaluru"
        assert profile["mobile"] == "+919812345678"

        education = client.get("/api/v1/candidate/education", headers=cand_headers).json()
        assert len(education) == 1
        assert education[0]["degree"] == "B.Tech"

        summary = client.get("/api/v1/candidate/experience-summary", headers=cand_headers).json()
        # 2018-07-01 -> 2024-06-30 is ~72 months
        assert 70 <= summary["total_months"] <= 73

    def test_resume_required(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        import json

        response = client.post(
            f"/api/v1/jobs/{job['id']}/applications",
            data={"payload": json.dumps(application_payload())},
            files=None,
            headers=cand_headers,
        )
        assert response.status_code == 422
        assert "resume" in response.json()["detail"].lower()

    def test_invalid_extension_rejected(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        response = submit_application(
            client,
            cand_headers,
            job["id"],
            payload=application_payload(),
            resume=b"malicious",
            resume_name="resume.txt",
            resume_type="text/plain",
        )
        assert response.status_code == 422
        assert "format" in response.json()["detail"].lower()

    def test_oversized_resume_rejected(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        big = TINY_PDF + b"\0" * (5 * 1024 * 1024 + 10)
        response = submit_application(
            client, cand_headers, job["id"], payload=application_payload(), resume=big
        )
        assert response.status_code == 422
        assert "maximum size" in response.json()["detail"]

    def test_missing_consent_rejected(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        response = _apply(client, job["id"], cand_headers, consent_privacy=False)
        assert response.status_code == 422
        assert "privacy" in response.json()["detail"].lower()

    def test_future_education_year_rejected(self, client):
        from datetime import datetime

        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        future_year = datetime.now().year + 3
        payload = application_payload()
        payload["education"][0]["year_of_passing"] = future_year
        response = submit_application(
            client, cand_headers, job["id"], payload=payload, resume=TINY_PDF
        )
        assert response.status_code == 422
        assert "future" in response.json()["detail"]

    def test_duplicate_application_conflict(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        first = _apply(client, job["id"], cand_headers)
        second = _apply(client, job["id"], cand_headers)
        assert first.status_code == 201
        assert second.status_code == 409
        assert "already applied" in second.json()["detail"]

    def test_cannot_apply_to_draft_job(self, client):
        admin_headers, _e = make_admin(client)
        draft = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Hidden Job",
                "department": "Engineering",
                "location": "Pune",
                "employment_type": "FULL_TIME",
                "experience_range": "2-4 years",
                "openings": 1,
                "hiring_manager": "Q",
                "responsibilities": "Draft.",
                "requirements": "N/A",
            },
            headers=admin_headers,
        ).json()
        cand_headers, _c, _t = make_candidate(client)
        response = _apply(client, draft["id"], cand_headers)
        assert response.status_code == 404

    def test_cannot_apply_to_closed_job(self, client):
        job, admin_headers = create_published_job(client)
        client.patch(f"/api/v1/admin/jobs/{job['id']}/close", headers=admin_headers)
        cand_headers, _c, _t = make_candidate(client)
        assert _apply(client, job["id"], cand_headers).status_code == 404

    def test_anonymous_submission_unauthorized(self, client):
        job, _admin = create_published_job(client)
        response = submit_application(
            client, {}, job["id"], payload=application_payload(), resume=TINY_PDF
        )
        assert response.status_code == 401

    def test_admin_cannot_apply(self, client):
        job, admin_headers = create_published_job(client)
        response = submit_application(
            client, admin_headers, job["id"], payload=application_payload(), resume=TINY_PDF
        )
        assert response.status_code == 403

    def test_fresher_flow_no_experience(self, client):
        job, admin_headers = create_published_job(client)
        cand_headers, _c, _t = make_candidate(client)
        payload = application_payload(experience=[])
        response = submit_application(
            client, cand_headers, job["id"], payload=payload, resume=TINY_PDF
        )
        assert response.status_code == 201

        grid = client.get(
            f"/api/v1/admin/jobs/{job['id']}/applications", headers=admin_headers
        ).json()
        row = next(r for r in grid["items"] if r["id"] == response.json()["id"])
        detail = client.get(f"/api/v1/admin/applications/{row['id']}", headers=admin_headers).json()
        assert detail["fresher"] is True
        assert detail["experience"] == []


class TestOwnershipAndValidation:
    def test_invalid_json_payload_rejected(self, client):
        job, _admin = create_published_job(client)
        cand_headers, _e, _t = make_candidate(client)
        response = client.post(
            f"/api/v1/jobs/{job['id']}/applications",
            data={"payload": "{not json"},
            files={"resume": ("r.pdf", TINY_PDF, "application/pdf")},
            headers=cand_headers,
        )
        assert response.status_code == 422

    def test_other_candidates_detail_hidden(self, client):
        job, _admin = create_published_job(client)
        cand_a, _ea, _ta = make_candidate(client)
        cand_b, _eb, _tb = make_candidate(client)

        created = _apply(client, job["id"], cand_a).json()
        other = client.get(
            f"/api/v1/candidate/applications/{created['id']}", headers=cand_b
        )
        assert other.status_code == 404
