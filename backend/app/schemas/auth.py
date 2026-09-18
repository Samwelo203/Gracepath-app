from pydantic import BaseModel, Field, ConfigDict, EmailStr
from datetime import datetime
from typing import Literal, Optional


RoleType = Literal["admin", "receptionist", "accounts", "clinician"]


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=72)
    full_name: str = Field(..., min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    role: RoleType = "receptionist"


class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[RoleType] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = Field(None, min_length=6, max_length=72)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=72)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead