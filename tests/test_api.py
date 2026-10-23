WRITE_HEADERS = {"X-Requested-With": "StudySpace"}


def register(client, email="alex@example.com", name="Alex Morgan", password="correct-horse-42"):
    return client.post(
        "/api/auth/register",
        headers=WRITE_HEADERS,
        json={"name": name, "email": email, "password": password},
    )


def test_registration_login_and_logout(client):
    response = register(client)
    assert response.status_code == 201
    assert response.json()["name"] == "Alex Morgan"
    assert "password" not in response.json()
    assert response.cookies.get("studyspace_session")

    assert client.get("/api/auth/me").json()["email"] == "alex@example.com"
    assert client.post(
        "/api/auth/logout", headers=WRITE_HEADERS
    ).status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    login_response = client.post(
        "/api/auth/login",
        headers=WRITE_HEADERS,
        json={"email": "ALEX@example.com", "password": "correct-horse-42"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["email"] == "alex@example.com"


def test_registration_validation_and_duplicate_email(client):
    assert register(client, password="short").status_code == 422
    assert register(client, name="  ").status_code == 422
    assert register(client).status_code == 201
    assert register(client).status_code == 409


def test_task_crud_and_account_isolation(client):
    assert register(client).status_code == 201
    created = client.post(
        "/api/tasks",
        headers=WRITE_HEADERS,
        json={
            "title": "  Read chapter four  ",
            "description": "  Take notes  ",
            "priority": "high",
            "due_date": "2026-11-05",
        },
    )
    assert created.status_code == 201
    task = created.json()
    assert task["title"] == "Read chapter four"
    assert task["description"] == "Take notes"
    assert task["priority"] == "high"

    updated = client.patch(
        f"/api/tasks/{task['id']}",
        headers=WRITE_HEADERS,
        json={"title": "Read chapter five"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Read chapter five"
    assert client.get("/api/tasks").json()[0]["id"] == task["id"]

    client.post("/api/auth/logout", headers=WRITE_HEADERS)
    assert register(client, email="sam@example.com", name="Sam").status_code == 201
    assert client.get("/api/tasks").json() == []
    assert client.patch(
        f"/api/tasks/{task['id']}",
        headers=WRITE_HEADERS,
        json={"title": "Not yours"},
    ).status_code == 404
    assert client.delete(f"/api/tasks/{task['id']}", headers=WRITE_HEADERS).status_code == 404


def test_task_validation_and_write_request_protection(client):
    register(client)
    assert client.post("/api/tasks", json={"title": "No request header"}).status_code == 403
    assert client.post(
        "/api/tasks",
        headers=WRITE_HEADERS,
        json={"title": "   ", "priority": "urgent"},
    ).status_code == 422

    created = client.post(
        "/api/tasks",
        headers=WRITE_HEADERS,
        json={"title": "A valid task"},
    )
    assert created.status_code == 201
    assert client.patch(
        f"/api/tasks/{created.json()['id']}",
        headers=WRITE_HEADERS,
        json={},
    ).status_code == 422
    assert client.patch(
        f"/api/tasks/{created.json()['id']}",
        headers=WRITE_HEADERS,
        json={"priority": None},
    ).status_code == 422
    assert client.delete(
        f"/api/tasks/{created.json()['id']}",
        headers=WRITE_HEADERS,
    ).status_code == 204
