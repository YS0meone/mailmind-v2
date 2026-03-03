"""Simple encryption for storing Google refresh tokens at rest."""

import base64

from cryptography.fernet import Fernet

from app.config import settings

# Derive a Fernet key from the NextAuth secret (must be at least 32 bytes)
_key = base64.urlsafe_b64encode(settings.nextauth_secret.encode().ljust(32, b"\0")[:32])
_fernet = Fernet(_key)


def encrypt_token(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()
