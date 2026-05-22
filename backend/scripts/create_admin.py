#!/usr/bin/env python3
"""
Script to create the initial admin user.
Run this once after the database is initialized.

Usage:
  docker compose exec backend python scripts/create_admin.py
  
  Or with custom credentials:
  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret python scripts/create_admin.py
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.core.database import Base


async def create_admin():
    email = os.getenv("ADMIN_EMAIL", "admin@bytebudd.local")
    password = os.getenv("ADMIN_PASSWORD", "admin123")

    engine = create_async_engine(settings.database_url, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as session:
        # Check if admin already exists
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"[!] Admin user '{email}' already exists (id={existing.id})")
            await engine.dispose()
            return

        # Create admin
        admin = User(
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        session.add(admin)
        await session.commit()
        await session.refresh(admin)

        print(f"[✓] Admin user created successfully!")
        print(f"    Email:    {email}")
        print(f"    Password: {password}")
        print(f"    Role:     admin")
        print(f"    ID:       {admin.id}")
        print()
        print("[!] Please change the password after first login!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_admin())
