from __future__ import annotations

import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_user_registration_and_login_flow():
    """Test user registration, duplicate handling, login, and profile retrieval."""
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"testuser_{unique_suffix}"
    email = f"test_{unique_suffix}@auditv.internal"
    password = "SecurePassword123!"

    # 1. Register new user
    reg_response = client.post(
        "/api/v1/users/register",
        json={
            "username": username,
            "email": email,
            "full_name": "Test User",
            "password": password,
        },
    )
    assert reg_response.status_code == 201
    token_data = reg_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    token = token_data["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Duplicate registration should fail
    dup_response = client.post(
        "/api/v1/users/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )
    assert dup_response.status_code == 400

    # 3. Login with valid credentials
    login_response = client.post(
        "/api/v1/users/login",
        json={"username": username, "password": password},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()

    # 4. Login with invalid password
    bad_login = client.post(
        "/api/v1/users/login",
        json={"username": username, "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # 5. Get current profile (/users/me)
    me_response = client.get("/api/v1/users/me", headers=auth_headers)
    assert me_response.status_code == 200
    user_info = me_response.json()
    assert user_info["username"] == username
    assert user_info["email"] == email


def test_user_chat_history_and_settings():
    """Test authenticated user settings update and chat history persistence."""
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"chattester_{unique_suffix}"
    email = f"chat_{unique_suffix}@auditv.internal"
    password = "PassWord123@"

    reg_res = client.post(
        "/api/v1/users/register",
        json={"username": username, "email": email, "password": password},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update settings
    settings_res = client.put(
        "/api/v1/users/me/settings",
        json={"similarity_threshold": "0.75"},
        headers=headers,
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["similarity_threshold"] == "0.75"

    # 2. Add chat message (returns 201 Created)
    chat_post = client.post(
        "/api/v1/users/me/chat",
        json={"role": "user", "content": "How do I save tax under Section 80C?"},
        headers=headers,
    )
    assert chat_post.status_code == 201
    assert chat_post.json()["content"] == "How do I save tax under Section 80C?"

    # 3. Retrieve chat history
    history_res = client.get("/api/v1/users/me/chat", headers=headers)
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 1
    assert history[0]["content"] == "How do I save tax under Section 80C?"

    # 4. Clear chat history
    del_res = client.delete("/api/v1/users/me/chat", headers=headers)
    assert del_res.status_code == 204
    history_after = client.get("/api/v1/users/me/chat", headers=headers).json()
    assert len(history_after) == 0


def test_user_financial_and_documents_endpoints():
    """Test authenticated user financial entries and documents storage."""
    unique_suffix = uuid.uuid4().hex[:8]
    username = f"finuser_{unique_suffix}"
    email = f"fin_{unique_suffix}@auditv.internal"
    password = "MyPassword999!"

    reg_res = client.post(
        "/api/v1/users/register",
        json={"username": username, "email": email, "password": password},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Add financial entry
    fin_res = client.post(
        "/api/v1/users/me/financial",
        json={"category": "salary_planner", "data": {"gross_salary": 1800000, "regime": "new"}},
        headers=headers,
    )
    assert fin_res.status_code == 201
    entry_id = fin_res.json()["id"]

    # 2. Get financial entries
    get_fin = client.get("/api/v1/users/me/financial", headers=headers)
    assert get_fin.status_code == 200
    assert len(get_fin.json()) == 1

    # 3. Add document
    doc_res = client.post(
        "/api/v1/users/me/documents",
        json={"filename": "Form16_FY2024.pdf", "file_type": "PDF", "notes": "Form 16 Tax return"},
        headers=headers,
    )
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]

    # 4. Get documents
    get_docs = client.get("/api/v1/users/me/documents", headers=headers)
    assert get_docs.status_code == 200
    assert len(get_docs.json()) == 1

    # 5. Delete document and financial entry
    del_doc = client.delete(f"/api/v1/users/me/documents/{doc_id}", headers=headers)
    assert del_doc.status_code == 204

    del_fin = client.delete(f"/api/v1/users/me/financial/{entry_id}", headers=headers)
    assert del_fin.status_code == 204
