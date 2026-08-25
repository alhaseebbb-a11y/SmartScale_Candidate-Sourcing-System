import re
from datetime import datetime, timezone

from tests.conftest import make_admin, make_candidate


class TestJobLifecycle:
    def test_create_defaults_to_draft(self, client):
        admin_headers, _email = make_admin(client)
        response = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Product Designer",
                "department": "Design",
                "location": "Remote",
                "employment_type": "CONTRACT",
                "experience_range": "3-5 years",
                "openings": 1,
                "hiring_manager": "Asha K",
                "responsibilities": "Design delightful experiences.",
                "requirements": "Design skills, Figma experience",
            },
            headers=admin_headers,
        )
        assert response.status_code == 201
        job = response.json()
        assert job["status"] == "DRAFT"
        assert job["posted_date"] is None
        assert re.fullmatch(r"REQ-\d{4}-\d{5}", job["requisition_id"])

    def test_draft_hidden_from_public(self, client):
        admin_headers, _e = make_admin(client)
        job = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Secret Role",
                "department": "Engineering",
                "location": "Pune",
                "employment_type": "FULL_TIME",
                "experience_range": "2-4 years",
                "openings": 1,
                "hiring_manager": "X",
                "responsibilities": "Internal only.",
                "requirements": "N/A",
            },
            headers=admin_headers,
        ).json()
        listing = client.get("/api/v1/jobs").json()
        assert all(j["id"] != job["id"] for j in listing["items"])
        detail = client.get(f"/api/v1/jobs/{job['id']}")
        assert detail.status_code == 404

    def test_publish_makes_visible_and_sets_posted_date(self, client):
        admin_headers, _e = make_admin(client)
        job = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Visible Role",
                "department": "Engineering",
                "location": "Remote",
                "employment_type": "FULL_TIME",
                "experience_range": "2-4 years",
                "openings": 1,
                "hiring_manager": "Y",
                "responsibilities": "Public.",
                "requirements": "N/A",
            },
            headers=admin_headers,
        ).json()
        published = client.patch(
            f"/api/v1/admin/jobs/{job['id']}/publish", headers=admin_headers
        )
        assert published.status_code == 200
        assert published.json()["status"] == "PUBLISHED"
        assert published.json()["posted_date"] is not None

        listing = client.get("/api/v1/jobs").json()
        assert any(j["id"] == job["id"] for j in listing["items"])
        detail = client.get(f"/api/v1/jobs/{job['id']}")
        assert detail.status_code == 200

    def test_close_removes_from_public_but_keeps_record(self, client):
        job, admin_headers = create_published_job_helper(client)
        closed = client.patch(f"/api/v1/admin/jobs/{job['id']}/close", headers=admin_headers)
        assert closed.status_code == 200
        assert closed.json()["status"] == "CLOSED"
        assert client.get(f"/api/v1/jobs/{job['id']}").status_code == 404
        admin_detail = client.get(f"/api/v1/admin/jobs/{job['id']}", headers=admin_headers)
        assert admin_detail.status_code == 200

    def test_invalid_transitions(self, client):
        job, admin_headers = create_published_job_helper(client)
        again = client.patch(f"/api/v1/admin/jobs/{job['id']}/publish", headers=admin_headers)
        assert again.status_code == 422

    def test_closed_cannot_be_republished(self, client):
        job, admin_headers = create_published_job_helper(client)
        client.patch(f"/api/v1/admin/jobs/{job['id']}/close", headers=admin_headers)
        reopen = client.patch(f"/api/v1/admin/jobs/{job['id']}/publish", headers=admin_headers)
        assert reopen.status_code == 422


class TestPublicSearchAndFilters:
    def test_search_matches_title_and_description(self, client):
        _job_a, admin_headers = create_published_job_helper(client, title="Python Backend Engineer")
        client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Sales Manager",
                "department": "Sales",
                "location": "Mumbai",
                "employment_type": "FULL_TIME",
                "experience_range": "5-8 years",
                "openings": 1,
                "hiring_manager": "S",
                "responsibilities": "Grow revenue using Python-led analytics tooling.",
                "requirements": "Sales experience, Python knowledge",
            },
            headers=admin_headers,
        )
        # publish the second job
        jobs_response = client.get("/api/v1/admin/jobs", headers=admin_headers).json()
        for j in jobs_response["items"]:
            if j["title"] == "Sales Manager":
                client.patch(f"/api/v1/admin/jobs/{j['id']}/publish", headers=admin_headers)

        result = client.get("/api/v1/jobs", params={"search": "python"}).json()
        assert result["total"] == 2
        titles = {j["title"] for j in result["items"]}
        assert "Python Backend Engineer" in titles
        assert "Sales Manager" in titles

    def test_department_filter(self, client):
        create_published_job_helper(client, department="Engineering")
        create_published_job_helper(client, title="HR Generalist", department="Human Resources")
        result = client.get("/api/v1/jobs", params={"department": "Engineering"}).json()
        assert result["total"] >= 1
        assert all(j["department"] == "Engineering" for j in result["items"])

    def test_location_partial_match(self, client):
        create_published_job_helper(client, location="Bengaluru North")
        result = client.get("/api/v1/jobs", params={"location": "bengaluru"}).json()
        assert result["total"] >= 1

    def test_employment_type_filter(self, client):
        create_published_job_helper(client, employment_type="INTERNSHIP")
        result = client.get("/api/v1/jobs", params={"employment_type": "INTERNSHIP"}).json()
        assert result["total"] >= 1
        assert all(j["employment_type"] == "INTERNSHIP" for j in result["items"])

    def test_pagination(self, client):
        for i in range(3):
            create_published_job_helper(client, title=f"Bulk Role {i}")
        page_one = client.get("/api/v1/jobs", params={"page": 1, "page_size": 2}).json()
        assert len(page_one["items"]) <= 2
        assert page_one["page"] == 1
        assert page_one["total"] >= 3


class TestAdminJobManagement:
    def test_edit_published_job_reflects_publicly(self, client):
        job, admin_headers = create_published_job_helper(client)
        updated = client.put(
            f"/api/v1/admin/jobs/{job['id']}",
            json={
                "title": job["title"],
                "department": job["department"],
                "location": "Goa Remote",
                "employment_type": job["employment_type"],
                "experience_range": job["experience_range"],
                "openings": job["openings"],
                "hiring_manager": job["hiring_manager"],
                "responsibilities": job["responsibilities"],
                "requirements": job["requirements"],
            },
            headers=admin_headers,
        )
        assert updated.status_code == 200
        public = client.get(f"/api/v1/jobs/{job['id']}").json()
        assert public["location"] == "Goa Remote"

    def test_duplicate_creates_new_draft(self, client):
        job, admin_headers = create_published_job_helper(client)
        clone = client.post(
            f"/api/v1/admin/jobs/{job['id']}/duplicate", headers=admin_headers
        )
        assert clone.status_code == 201
        clone_body = clone.json()
        assert clone_body["status"] == "DRAFT"
        assert clone_body["title"] == f"Copy of {job['title']}"
        assert clone_body["requisition_id"] != job["requisition_id"]
        assert clone_body["posted_date"] is None

    def test_admin_list_includes_application_count(self, client):
        from tests.conftest import TINY_PDF, application_payload, submit_application

        job, admin_headers = create_published_job_helper(client)
        cand_headers, _email, _t = make_candidate(client)
        submitted = submit_application(
            client, cand_headers, job["id"], payload=application_payload(), resume=TINY_PDF
        )
        assert submitted.status_code == 201, submitted.text

        listing = client.get("/api/v1/admin/jobs", headers=admin_headers).json()
        target = next(j for j in listing["items"] if j["id"] == job["id"])
        assert target["application_count"] == 1

    def test_anonymous_cannot_access_admin_jobs(self, client):
        assert client.get("/api/v1/admin/jobs").status_code == 401

    def test_candidate_cannot_create_job(self, client):
        cand_headers, _e, _t = make_candidate(client)
        response = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Hack",
                "department": "Engineering",
                "location": "X",
                "employment_type": "FULL_TIME",
                "experience_range": "0-0 years",
                "openings": 1,
                "hiring_manager": "H",
                "responsibilities": "Nope.",
                "requirements": "N/A",
            },
            headers=cand_headers,
        )
        assert response.status_code == 403

    def test_unknown_department_rejected(self, client):
        admin_headers, _e = make_admin(client)
        response = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "Bad Dept",
                "department": "Space Operations",
                "location": "Moon",
                "employment_type": "FULL_TIME",
                "experience_range": "1-2 years",
                "openings": 1,
                "hiring_manager": "M",
                "responsibilities": "...",
                "requirements": "...",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422

    def test_zero_openings_rejected(self, client):
        admin_headers, _e = make_admin(client)
        response = client.post(
            "/api/v1/admin/jobs",
            json={
                "title": "No openings",
                "department": "Engineering",
                "location": "Delhi",
                "employment_type": "FULL_TIME",
                "experience_range": "1-2 years",
                "openings": 0,
                "hiring_manager": "M",
                "responsibilities": "...",
                "requirements": "...",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422


def create_published_job_helper(client, **overrides):
    from tests.conftest import create_published_job

    return create_published_job(client, **overrides)
