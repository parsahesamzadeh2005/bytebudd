"""Auth-related Pydantic schemas."""

from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: str  # plain str so .local / custom TLDs are accepted
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class SetupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[Literal["admin", "user"]] = None
    password: Optional[str] = None


class RegistrationStatusOut(BaseModel):
    allow_registration: bool


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v
