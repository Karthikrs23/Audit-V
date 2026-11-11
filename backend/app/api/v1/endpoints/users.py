"""Auth and user personal-space endpoints for Audit V."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, hash_password, verify_password
from app.core.dependencies import get_current_user
from app.databace.database import get_db
from app.databace.models import User, UserChatMessage, UserDocument, UserFinancialEntry, UserSetting
from app.schemas.user import (
    ChatMessageIn, ChatMessageOut,
    DocumentIn, DocumentOut,
    FinancialEntryIn, FinancialEntryOut,
    Token, UserLogin, UserOut, UserRegister,
    UserSettingsIn, UserSettingsOut,
)

router = APIRouter(prefix="/users", tags=["users"])


# ─── Registration & Login ─────────────────────────────────────────────────────

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account and return a JWT access token."""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default settings row
    db.add(UserSetting(user_id=user.id))
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate an existing user and return a JWT access token."""
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


# ─── Chat History ─────────────────────────────────────────────────────────────

@router.get("/me/chat", response_model=list[ChatMessageOut])
def get_chat_history(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the user's AI assistant chat history (most recent last)."""
    return (
        db.query(UserChatMessage)
        .filter(UserChatMessage.user_id == current_user.id)
        .order_by(UserChatMessage.timestamp.asc())
        .limit(limit)
        .all()
    )


@router.post("/me/chat", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
def save_chat_message(
    payload: ChatMessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a single AI assistant chat message for the user."""
    msg = UserChatMessage(user_id=current_user.id, role=payload.role, content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.delete("/me/chat", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all chat messages for the current user."""
    db.query(UserChatMessage).filter(UserChatMessage.user_id == current_user.id).delete()
    db.commit()


# ─── Financial Entries ────────────────────────────────────────────────────────

@router.get("/me/financial", response_model=list[FinancialEntryOut])
def get_financial_entries(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return financial entries for the user, optionally filtered by category."""
    q = db.query(UserFinancialEntry).filter(UserFinancialEntry.user_id == current_user.id)
    if category:
        q = q.filter(UserFinancialEntry.category == category)
    return q.order_by(UserFinancialEntry.created_at.desc()).all()


@router.post("/me/financial", response_model=FinancialEntryOut, status_code=status.HTTP_201_CREATED)
def save_financial_entry(
    payload: FinancialEntryIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store a financial data entry for the current user."""
    entry = UserFinancialEntry(user_id=current_user.id, category=payload.category, data=payload.data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/me/financial/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_financial_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a specific financial entry belonging to the current user."""
    entry = db.query(UserFinancialEntry).filter(
        UserFinancialEntry.id == entry_id,
        UserFinancialEntry.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


# ─── Documents ────────────────────────────────────────────────────────────────

@router.get("/me/documents", response_model=list[DocumentOut])
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(UserDocument)
        .filter(UserDocument.user_id == current_user.id)
        .order_by(UserDocument.created_at.desc())
        .all()
    )


@router.post("/me/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def add_document(
    payload: DocumentIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = UserDocument(
        user_id=current_user.id,
        filename=payload.filename,
        file_type=payload.file_type,
        notes=payload.notes,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/me/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(UserDocument).filter(
        UserDocument.id == doc_id,
        UserDocument.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.get("/me/settings", response_model=UserSettingsOut)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not s:
        s = UserSetting(user_id=current_user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.put("/me/settings", response_model=UserSettingsOut)
def update_settings(
    payload: UserSettingsIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not s:
        s = UserSetting(user_id=current_user.id)
        db.add(s)

    if payload.api_url is not None:
        s.api_url = payload.api_url
    if payload.hf_model is not None:
        s.hf_model = payload.hf_model
    if payload.hf_adapter is not None:
        s.hf_adapter = payload.hf_adapter
    if payload.similarity_threshold is not None:
        s.similarity_threshold = payload.similarity_threshold

    db.commit()
    db.refresh(s)
    return s
