from tests.conftest import ADMIN_PASSWORD, CANDIDATE_PASSWORD, make_admin, make_candidate, unique_email


class TestRegistration:
    def test_register_returns_tokens_and_user(self, client):
        headers, email, tokens = make_candidate(client)
        assert tokens["access_token"]
        assert tokens["refresh_token"]
        assert tokens["token_type"] == "bearer"
        assert tokens["user"]["email"] == email
        assert tokens["user"]["role"] == "CANDIDATE"

    def test_register_unverified_email_rejected(self, client):
        email = unique_email()
        response = client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Rahul",
                "last_name": "Sharma",
                "email": email,
                "password": CANDIDATE_PASSWORD,
            },
        )
        assert response.status_code == 400
        assert "verify your email" in response.json()["detail"].lower()

    def test_duplicate_email_conflict(self, client):
        _headers, email, _tokens = make_candidate(client)
        response = client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Another",
                "last_name": "User",
                "email": email,
                "password": CANDIDATE_PASSWORD,
            },
        )
        assert response.status_code == 409

    def test_invalid_email_rejected(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "first_name": "A",
                "last_name": "B",
                "email": "not-an-email",
                "password": CANDIDATE_PASSWORD,
            },
        )
        assert response.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        _headers, email, _tokens = make_candidate(client)
        response = client.post(
            "/api/v1/auth/login", json={"email": email, "password": CANDIDATE_PASSWORD}
        )
        assert response.status_code == 200
        assert response.json()["user"]["email"] == email

    def test_wrong_password(self, client):
        _headers, email, _tokens = make_candidate(client)
        response = client.post(
            "/api/v1/auth/login", json={"email": email, "password": "WrongPass@1"}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."

    def test_unknown_email_same_error_as_wrong_password(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": unique_email(), "password": "Whatever@123"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."

    def test_admin_can_login(self, client):
        headers, email = make_admin(client)
        assert headers["Authorization"].startswith("Bearer ")
        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["role"] == "ADMIN"


class TestMe:
    def test_requires_token(self, client):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_rejects_garbage_token(self, client):
        response = client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert response.status_code == 401

    def test_returns_current_user(self, client):
        headers, email, _t = make_candidate(client)
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["email"] == email


class TestRefresh:
    def test_refresh_issues_new_pair(self, client):
        _h, _e, tokens = make_candidate(client)
        response = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["access_token"] != tokens["access_token"]

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200

    def test_access_token_cannot_refresh(self, client):
        _h, _e, tokens = make_candidate(client)
        response = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": tokens["access_token"]}
        )
        assert response.status_code == 401


class TestPasswordReset:
    def test_forgot_password_generic_response_even_for_unknown_email(self, client):
        response = client.post(
            "/api/v1/auth/forgot-password", json={"email": unique_email()}
        )
        assert response.status_code == 202
        assert "If an account exists" in response.json()["message"]

    def test_full_reset_flow(self, client, caplog):
        import logging
        import re

        caplog.set_level(logging.INFO)
        password = CANDIDATE_PASSWORD
        _headers, email, _t = make_candidate(client, password=password)

        client.post("/api/v1/auth/forgot-password", json={"email": email})

        log_output = "\n".join(record.getMessage() for record in caplog.records)
        match = re.search(r"reset-password\?token=([A-Za-z0-9\-_.]+)", log_output)
        assert match, f"No reset link found in console email output: {log_output[:500]}"
        token = match.group(1)

        new_password = "NewSecure@456"
        reset = client.post(
            "/api/v1/auth/reset-password", json={"token": token, "new_password": new_password}
        )
        assert reset.status_code == 200

        old_login = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login", json={"email": email, "password": new_password}
        )
        assert new_login.status_code == 200

    def test_bogus_reset_token_rejected(self, client):
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "garbage-token-value", "new_password": "NewSecure@456"},
        )
        assert response.status_code == 400
