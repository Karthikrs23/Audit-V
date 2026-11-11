import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_user_data_isolation_chat_and_tax_profile():
    """Verify that User B cannot read User A's chat history or tax profile via any endpoint."""
    uid_a = uuid.uuid4().hex[:8]
    uid_b = uuid.uuid4().hex[:8]

    # 1. Register User A
    user_a_payload = {
        "username": f"user_a_{uid_a}",
        "email": f"usera_{uid_a}@auditv.internal",
        "password": "StrongPassword123!",
        "full_name": "User Alpha",
    }
    reg_a = client.post("/api/v1/users/register", json=user_a_payload)
    assert reg_a.status_code == 201, reg_a.text
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. User A stores confidential chat message
    chat_payload = {"role": "user", "content": "Confidential Tax Consultation for User A (Income: Rs 24 Lakhs)"}
    save_chat_a = client.post("/api/v1/users/me/chat", json=chat_payload, headers=headers_a)
    assert save_chat_a.status_code == 201
    chat_a_id = save_chat_a.json()["id"]

    # 3. User A stores confidential tax profile / financial entry
    fin_payload = {
        "category": "tax_profile",
        "data": {
            "gross_income": 2400000,
            "pan": "ABCDE1234F",
            "regime": "New Tax Regime",
            "projected_tax": 292500,
        },
    }
    save_fin_a = client.post("/api/v1/users/me/financial", json=fin_payload, headers=headers_a)
    assert save_fin_a.status_code == 201
    entry_a_id = save_fin_a.json()["id"]

    # Verify User A can read their own data
    chat_res_a = client.get("/api/v1/users/me/chat", headers=headers_a)
    assert chat_res_a.status_code == 200
    assert len(chat_res_a.json()) == 1
    assert "User A" in chat_res_a.json()[0]["content"]

    fin_res_a = client.get("/api/v1/users/me/financial", headers=headers_a)
    assert fin_res_a.status_code == 200
    assert len(fin_res_a.json()) == 1
    assert fin_res_a.json()[0]["data"]["pan"] == "ABCDE1234F"

    # 4. Register User B
    user_b_payload = {
        "username": f"user_b_{uid_b}",
        "email": f"userb_{uid_b}@auditv.internal",
        "password": "StrongPassword123!",
        "full_name": "User Beta",
    }
    reg_b = client.post("/api/v1/users/register", json=user_b_payload)
    assert reg_b.status_code == 201, reg_b.text
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 5. User B calls GET /api/v1/users/me/chat -> MUST NOT see User A's chat
    chat_res_b = client.get("/api/v1/users/me/chat", headers=headers_b)
    assert chat_res_b.status_code == 200
    messages_b = chat_res_b.json()
    assert len(messages_b) == 0, f"Data leak detected! User B saw messages: {messages_b}"
    assert not any(chat_a_id == m.get("id") for m in messages_b)

    # 6. User B calls GET /api/v1/users/me/financial -> MUST NOT see User A's tax profile
    fin_res_b = client.get("/api/v1/users/me/financial", headers=headers_b)
    assert fin_res_b.status_code == 200
    entries_b = fin_res_b.json()
    assert len(entries_b) == 0, f"Data leak detected! User B saw financial entries: {entries_b}"
    assert not any(entry_a_id == e.get("id") for e in entries_b)

    # 7. User B calls GET /api/v1/users/me -> Profile must be User B only
    profile_b = client.get("/api/v1/users/me", headers=headers_b)
    assert profile_b.status_code == 200
    assert profile_b.json()["username"] == f"user_b_{uid_b}"
    assert profile_b.json()["full_name"] == "User Beta"

    # 8. User B attempts unauthorized deletion of User A's financial entry -> MUST return 404
    del_res = client.delete(f"/api/v1/users/me/financial/{entry_a_id}", headers=headers_b)
    assert del_res.status_code == 404, f"Expected 404, got {del_res.status_code}"

    # Confirm User A's entry is still safely intact
    fin_res_a_after = client.get("/api/v1/users/me/financial", headers=headers_a)
    assert len(fin_res_a_after.json()) == 1
