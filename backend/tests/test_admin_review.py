import logging
import re

from tests.conftest import (
    TINY_PDF,
    application_payload,
    create_published_job,
    make_admin,
    make_candidate,
    submit_application,
)


def _setup_application(client, **payload_overrides):
    job, admin_headers = create_published_job(client)
    cand_headers, email, _t = make_candidate(client)
    payload = application_payload(**payload_overrides)
    response = submit_application(
        client, cand_headers, job["id"], payload=payload, resume=TINY_PDF
    )
    assert response.status_code == 201, response.text
    return job, admin_headers, cand_headers, email, response.json()


class TestApplicationsGrid:
    def test_grid_lists_submission(self, client):
        job, admin_headers, _c, email, created = _setup_application(client)
        grid = client.get(
            f"/api/v1/admin/jobs/{job['id']}/applications", headers=admin_headers
        ).json()
        assert grid["total"] == 1
        row = grid["items"][0]
        assert row["application_number"] == created["application_number"]
        assert row["candidate_name"] == "Rahul Sharma"
        assert row["status"] == "NEW"

    def test_search_by_name_and_filter_by_status(self, client):
        job, admin_headers, *_rest, created = _setup_application(client)

        by_name = client.get(
            f"/api/v1/admin/jobs/{job['id']}/applications",
            params={"search": "sharma"},
            headers=admin_headers,
        ).json()
        assert by_name["total"] == 1

        shortlisted = client.get(
            f"/api/v1/admin/jobs/{job['id']}/applications",
            params={"status": "SHORTLISTED"},
            headers=admin_headers,
        ).json()
        assert shortlisted["total"] == 0

    def test_consolidated_view_across_requisitions(self, client):
        job_a, admin_headers, cand_headers, _e, created_a = _setup_application(client)
        job_b, _ = create_published_job(client, title="Second Requisition", admin_headers=admin_headers)

        # apply to the second requisition with a different candidate
        other_cand, _oemail, _ot = make_candidate(client)
        submit_application(
            client, other_cand, job_b["id"], payload=application_payload(), resume=TINY_PDF
        )

        everything = client.get("/api/v1/admin/applications", headers=admin_headers).json()
        assert everything["total"] == 2

        only_b = client.get(
            "/api/v1/admin/applications",
            params={"job_id": job_b["id"]},
            headers=admin_headers,
        ).json()
        assert only_b["total"] == 1
        assert only_b["items"][0]["job_title"] == "Second Requisition"


class TestApplicationReview:
    def test_detail_contains_snapshots(self, client):
        _job, admin_headers, _c, email, created = _setup_application(client)
        detail = client.get(
            f"/api/v1/admin/applications/{created['id']}", headers=admin_headers
        ).json()
        assert detail["email"] == email
        assert detail["mobile"] == "+919812345678"
        assert len(detail["education"]) == 1
        assert detail["education"][0]["institution"] == "IIT Delhi"
        assert len(detail["experience"]) == 1
        assert detail["experience"][0]["company"] == "TechCorp"
        assert detail["cover_note"] == "I am excited about this role."
        assert detail["resume_url"].endswith(f"/admin/applications/{created['id']}/resume")
        assert detail["consent_accuracy"] and detail["consent_privacy"]

    def test_resume_download(self, client):
        _job, admin_headers, _c, _e, created = _setup_application(client)
        response = client.get(
            f"/api/v1/admin/applications/{created['id']}/resume", headers=admin_headers
        )
        assert response.status_code == 200
        assert response.content == TINY_PDF
        disposition = response.headers.get("content-disposition", "")
        assert "resume.pdf" in disposition

    def test_status_update_flow(self, client):
        _job, admin_headers, cand_headers, _e, created = _setup_application(client)

        updated = client.patch(
            f"/api/v1/admin/applications/{created['id']}/status",
            json={"status": "SHORTLISTED"},
            headers=admin_headers,
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "SHORTLISTED"

        mine = client.get("/api/v1/candidate/applications", headers=cand_headers).json()
        assert mine["items"][0]["status"] == "SHORTLISTED"

        same_again = client.patch(
            f"/api/v1/admin/applications/{created['id']}/status",
            json={"status": "SHORTLISTED"},
            headers=admin_headers,
        )
        assert same_again.status_code == 422

    def test_invalid_status_value_rejected(self, client):
        _job, admin_headers, _c, _e, created = _setup_application(client)
        response = client.patch(
            f"/api/v1/admin/applications/{created['id']}/status",
            json={"status": "HIRED"},
            headers=admin_headers,
        )
        assert response.status_code == 422

    def test_csv_export(self, client):
        job, admin_headers, _c, email, created = _setup_application(client)
        response = client.get(
            f"/api/v1/admin/jobs/{job['id']}/applications/export",
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        text = response.content.decode("utf-8-sig")
        lines = [line for line in text.splitlines() if line.strip()]
        assert lines[0].startswith("Application ID")
        assert len(lines) == 2
        assert created["application_number"] in lines[1]
        assert "Rahul Sharma" in lines[1]
        assert email not in lines[0]  # header row sanity

    def test_csv_export_all_jobs(self, client):
        _job, admin_headers, _c, _e, created = _setup_application(client)
        response = client.get("/api/v1/admin/applications/export", headers=admin_headers)
        assert response.status_code == 200
        text = response.content.decode("utf-8-sig")
        assert created["application_number"] in text


class TestNotifications:
    def test_admin_notified_of_new_application(self, client):
        _job, admin_headers, _c, _e, _created = _setup_application(client)

        unread = client.get("/api/v1/notifications/unread-count", headers=admin_headers).json()
        assert unread["count"] >= 1

        listing = client.get("/api/v1/notifications", headers=admin_headers).json()
        notification = next(
            n for n in listing["items"] if n["notification_type"] == "NEW_APPLICATION"
        )
        assert "Rahul Sharma" in notification["message"]
        assert notification["reference_id"] is not None

    def test_mark_read_decrements(self, client):
        _job, admin_headers, _c, _e, _created = _setup_application(client)
        first_unread = client.get(
            "/api/v1/notifications/unread-count", headers=admin_headers
        ).json()["count"]

        listing = client.get("/api/v1/notifications", headers=admin_headers).json()
        target = listing["items"][0]
        marked = client.patch(
            f"/api/v1/notifications/{target['id']}/read", headers=admin_headers
        )
        assert marked.status_code == 200
        after = client.get("/api/v1/notifications/unread-count", headers=admin_headers).json()["count"]
        assert after == first_unread - 1

    def test_read_all(self, client):
        _job, admin_headers, _c, _e, _created = _setup_application(client)
        marked = client.post("/api/v1/notifications/read-all", headers=admin_headers)
        assert marked.status_code == 200
        after = client.get("/api/v1/notifications/unread-count", headers=admin_headers).json()["count"]
        assert after == 0

    def test_candidate_notified_on_status_change(self, client):
        _job, admin_headers, cand_headers, _e, created = _setup_application(client)
        client.patch(
            f"/api/v1/admin/applications/{created['id']}/status",
            json={"status": "REVIEWED"},
            headers=admin_headers,
        )
        unread = client.get("/api/v1/notifications/unread-count", headers=cand_headers).json()
        assert unread["count"] >= 1
        listing = client.get("/api/v1/notifications", headers=cand_headers).json()
        assert any(n["notification_type"] == "STATUS_CHANGED" for n in listing["items"])

    def test_confirmation_email_logged_for_candidate(self, client, caplog):
        caplog.set_level(logging.INFO)
        _job, _admin, cand_headers, email, created = _setup_application(client)
        log_output = "\n".join(record.getMessage() for record in caplog.records)
        assert f"To: {email}" in log_output
        assert created["application_number"] in log_output


class TestAuthorizationBoundaries:
    def test_candidate_cannot_access_admin_grid(self, client):
        _job, _admin, cand_headers, _e, _created = _setup_application(client)
        response = client.get("/api/v1/admin/applications", headers=cand_headers)
        assert response.status_code == 403

    def test_anonymous_cannot_access_admin_grid(self, client):
        response = client.get("/api/v1/admin/applications")
        assert response.status_code == 401

    def test_candidate_cannot_update_status(self, client):
        _job, _admin, cand_headers, _e, created = _setup_application(client)
        response = client.patch(
            f"/api/v1/admin/applications/{created['id']}/status",
            json={"status": "REJECTED"},
            headers=cand_headers,
        )
        assert response.status_code == 403

    def test_candidate_cannot_download_resume(self, client):
        _job, _admin, cand_headers, _e, created = _setup_application(client)
        response = client.get(
            f"/api/v1/admin/applications/{created['id']}/resume", headers=cand_headers
        )
        assert response.status_code == 403
