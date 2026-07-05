"""
Auth endpoints: login, setup (first-run), register (public when enabled / admin always),
current user, list/manage users, registration toggle.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user, get_admin_user
from app.models.user import User
from app.models.app_settings import AppSettings
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserOut, UserCreate, UserUpdate,
    SetupRequest, RegisterRequest, RegistrationStatusOut,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).where(AppSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        # Should never happen after migration, but be defensive
        settings = AppSettings(id=1, allow_registration=False)
        db.add(settings)
        await db.flush()
    return settings


# ── public endpoints ──────────────────────────────────────────────────────────

@router.get("/setup-required")
async def setup_required(db: AsyncSession = Depends(get_db)):
    """Returns true when no users exist yet (first-run detection)."""
    result = await db.execute(select(func.count()).select_from(User))
    return {"required": result.scalar() == 0}


@router.post("/setup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def setup(payload: SetupRequest, db: AsyncSession = Depends(get_db)):
    """
    Create the first admin user. Only callable when the users table is empty.
    Subsequent calls return 409.
    """
    result = await db.execute(select(func.count()).select_from(User))
    if result.scalar() > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Setup has already been completed.",
        )

    user = User(
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role="admin",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/registration-open", response_model=RegistrationStatusOut)
async def registration_open(db: AsyncSession = Depends(get_db)):
    """Public endpoint — tells the frontend whether self-registration is enabled."""
    s = await _get_settings(db)
    return RegistrationStatusOut(allow_registration=s.allow_registration)


@router.post("/register-public", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_public(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Self-registration endpoint. Only works when an admin has enabled registration.
    Creates a regular (non-admin) user account.
    """
    s = await _get_settings(db)
    if not s.allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently closed. Contact your administrator.",
        )

    result = await db.execute(select(User).where(User.email == payload.email.strip().lower()))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    user = User(
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


# ── authenticated endpoints ───────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserOut.model_validate(current_user)


# ── admin-only endpoints ──────────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Register a new user directly. Admin only — works regardless of registration toggle."""
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """List all users. Admin only."""
    result = await db.execute(select(User).order_by(User.id))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update a user's role, active status, or password. Admin only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        user.role = payload.role
    if payload.password:
        user.password_hash = hash_password(payload.password)

    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Delete a user. Admin only. Cannot delete yourself."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    await db.delete(user)
    await db.flush()


@router.patch("/settings/registration", response_model=RegistrationStatusOut)
async def set_registration(
    payload: RegistrationStatusOut,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Enable or disable public self-registration. Admin only."""
    s = await _get_settings(db)
    s.allow_registration = payload.allow_registration
    await db.flush()
    return RegistrationStatusOut(allow_registration=s.allow_registration)



@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return a JWT token."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Register a new user. Admin only."""
    # Check email not taken
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """List all users. Admin only."""
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return [UserOut.model_validate(u) for u in users]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: "UserUpdate",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Update a user's role or active status. Admin only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from disabling themselves
    if user.id == admin.id and payload.is_active is False:
        raise HTTPException(
            status_code=400, detail="You cannot disable your own account"
        )

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        user.role = payload.role
    if payload.password:
        user.password_hash = hash_password(payload.password)

    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Delete a user. Admin only. Cannot delete yourself."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    await db.delete(user)
    await db.flush()
