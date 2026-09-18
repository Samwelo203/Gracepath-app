from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.auth import (
    UserCreate, UserRead, UserUpdate, PasswordChange, LoginRequest, TokenResponse,
)
from app.services import auth_service
from app.core.security import create_access_token, get_current_user, require_admin
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT."""
    user = auth_service.authenticate(db, payload.username, payload.password)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead)
def me(current: User = Depends(get_current_user)):
    return current


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    auth_service.change_password(db, current, payload)
    return {"message": "Password changed"}


# ---------- User management (admin only) ----------
@router.post("/users", response_model=UserRead, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return auth_service.create_user(db, payload)


@router.get("/users", response_model=List[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return auth_service.list_users(db, skip, limit)


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return auth_service.update_user(db, user_id, payload)


@router.delete("/users/{user_id}", status_code=204)
def delete_inactive_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    auth_service.delete_inactive_user(db, user_id, admin)
    return None