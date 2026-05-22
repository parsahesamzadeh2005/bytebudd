"""
Symmetric encryption for storing database connection passwords.
Uses Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography library.
"""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _get_fernet() -> Fernet:
    """
    Derive a valid 32-byte Fernet key from the configured ENCRYPTION_KEY.
    We SHA-256 hash the key to ensure it's exactly 32 bytes, then base64-encode.
    """
    key_bytes = hashlib.sha256(settings.encryption_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_password(plain_password: str) -> str:
    """Encrypt a database password for storage."""
    fernet = _get_fernet()
    return fernet.encrypt(plain_password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """Decrypt a stored database password."""
    fernet = _get_fernet()
    return fernet.decrypt(encrypted_password.encode()).decode()
