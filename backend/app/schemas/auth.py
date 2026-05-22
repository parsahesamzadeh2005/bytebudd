"""Auth-related Pydantic schemas."""

from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: str  # plain str so .local / custom TLDs are accepted
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


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
