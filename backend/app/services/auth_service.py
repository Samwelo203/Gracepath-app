from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import datetime, timezone

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, PasswordChange
from app.core.security import hash_password, verify_password


def create_user(db: Session, data: UserCreate) -> User:
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(409, f"Username '{data.username}' already taken")
    if data.email and db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, f"Email '{data.email}' already in use")

    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Could not create user (duplicate field)")
    db.refresh(user)
    return user


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, f"User {user_id} not found")
    return user


def list_users(db: Session, skip: int = 0, limit: int = 200):
    return db.query(User).order_by(User.id).offset(skip).limit(limit).all()


def authenticate(db: Session, username: str, password: str) -> User:
    user = get_user_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(403, "This account is disabled")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: UserUpdate) -> User:
    user = get_user(db, user_id)
    if data.email and data.email != user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(409, "Email already in use")
    values = data.model_dump(exclude_unset=True)
    new_password = values.pop("new_password", None)
    if new_password:
        user.hashed_password = hash_password(new_password)
    for field, value in values.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def delete_inactive_user(db: Session, user_id: int, admin: User) -> None:
    user = get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(400, "You cannot delete your own account")
    if user.is_active:
        raise HTTPException(400, "Only inactive users can be deleted")
    db.delete(user)
    db.commit()


def change_password(db: Session, user: User, data: PasswordChange) -> None:
    if not verify_password(data.old_password, user.hashed_password):
        raise HTTPException(400, "Old password is incorrect")
    user.hashed_password = hash_password(data.new_password)
    db.commit()


def ensure_default_admin(db: Session) -> None:
    """Create default admin on first run if no users exist."""
    if db.query(User).count() == 0:
        admin = User(
            username="admin",
            full_name="System Administrator",
            email="admin@gracepath.local",
            hashed_password=hash_password("GracePath2026!"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("[auth] Created default admin -> username: admin  password: GracePath2026!")