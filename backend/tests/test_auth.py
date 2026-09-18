def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_login_success(client, admin_user):
    res = client.post(
        "/api/auth/login",
        data={"username": "admin@test.com", "password": "AdminPass123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client, admin_user):
    res = client.post(
        "/api/auth/login",
        data={"username": "admin@test.com", "password": "WrongPassword"},
    )
    assert res.status_code == 401


def test_me_authenticated(client, admin_headers):
    res = client.get("/api/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "admin@test.com"
    assert data["role"] == "admin"


def test_me_unauthorized(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_create_user_admin_only(client, admin_headers, employee_headers):
    payload = {
        "email": "newemp@test.com",
        "full_name": "New Employee",
        "password": "Password123!",
        "role": "employee",
    }
    # Employee cannot create users
    res_emp = client.post("/api/users", json=payload, headers=employee_headers)
    assert res_emp.status_code == 403

    # Admin can create users
    res_admin = client.post("/api/users", json=payload, headers=admin_headers)
    assert res_admin.status_code == 201
    data = res_admin.json()
    assert data["email"] == "newemp@test.com"
    assert data["role"] == "employee"
