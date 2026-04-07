"""Auth router — register, login, and robust Firebase integrations."""

import logging
logger = logging.getLogger("auth")

import asyncio
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from app.config import settings
from app.database import get_db
from app.models import User, Account
from app.schemas import (
    TokenResponse, UserLogin, UserOut, UserRegister,
    ApiKeyResponse, WebhookCreate, WebhookOut
)
from app.dependencies import get_current_user
from app.services.rate_limit import login_limiter, register_limiter

# Natively initialize Firebase Admin context.
# Prefer an explicit credential path from GOOGLE_APPLICATION_CREDENTIALS.
if not firebase_admin._apps:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service-account.json")
    if not os.path.isfile(credentials_path):
        raise RuntimeError(
            "Firebase Admin credentials file is missing. Set GOOGLE_APPLICATION_CREDENTIALS or place service-account.json in the project root."
        )
    try:
        firebase_admin.initialize_app(credentials.Certificate(credentials_path))
    except Exception as e:
        raise RuntimeError(f"Firebase Admin initialization failed: {e}")

router = APIRouter(prefix="/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class FirebaseLoginRequest(BaseModel):
    token: str = Field(..., description="Firebase ID Token explicitly received via Frontend popup")

def _create_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _rate: None = Depends(register_limiter),
):
    """Create a new user with a hashed password."""
    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already registered")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=pwd_context.hash(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # ── Auto-provision primary account ──
    account = Account(owner_id=user.id, account_type="savings", balance=0.0)
    db.add(account)
    await db.commit()

    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    body: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _rate: None = Depends(login_limiter),
):
    """Authenticate and return a JWT token."""
    logger.info(f"Login attempt for identifier: {body.username}")
    result = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.username))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        logger.warning(f"Login failed: User not found for {body.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not pwd_context.verify(body.password, user.hashed_password):
        logger.warning(f"Login failed: Password mismatch for {user.email}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    logger.info(f"Login successful for {user.email}")
    return TokenResponse(access_token=_create_token(user.id, user.role))

@router.post("/firebase-login", response_model=TokenResponse)
async def firebase_login(
    body: FirebaseLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _rate: None = Depends(login_limiter),
):
    """Complete Zero-Trust Verification executing the raw Firebase ID natively."""
    try:
        # 1. Decode and verify signature asynchronously against Google's public instances
        decoded_token = await asyncio.to_thread(firebase_auth.verify_id_token, body.token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Firebase verification failure: {str(e)}")

    email = decoded_token.get("email")
    uid = decoded_token.get("uid")

    if not email or not uid:
        raise HTTPException(
            status_code=400,
            detail="Firebase token omitted essential identity claims.",
        )

    # 2. Synchronize internal backend representation of external Firebase User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        # 3. Provision a unique internal username derived from Firebase user info.
        base_username = re.sub(r"[^A-Za-z0-9_]", "", email.split('@')[0]) or "firebase_user"
        candidate_username = f"{base_username}_{uid[:8]}"
        index = 1
        while True:
            result = await db.execute(select(User).where(User.username == candidate_username))
            if result.scalar_one_or_none() is None:
                break
            candidate_username = f"{base_username}_{uid[:8]}_{index}"
            index += 1

        user = User(
            username=candidate_username,
            email=email,
            hashed_password=pwd_context.hash(secrets.token_urlsafe(32)),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # ── Auto-provision primary account ──
        account = Account(owner_id=user.id, account_type="savings", balance=0.0)
        db.add(account)
        await db.commit()

    # 4. Map internally executing correct context Token issuing bridging Sentinel infrastructure seamlessly
    return TokenResponse(access_token=_create_token(user.id, user.role))


# ────────────────────────────── Developer Platform (BaaS) ──────────────────────────────

@router.post("/api-keys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def generate_api_key(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key. The raw key is returned only once."""
    raw_key = "sk_" + secrets.token_urlsafe(32)
    prefix = raw_key[:8]
    import hashlib
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()

    api_key_record = __import__("app").models.ApiKey(
        user_id=user.id,
        hashed_key=hashed_key,
        prefix=prefix
    )
    db.add(api_key_record)
    await db.commit()

    return ApiKeyResponse(raw_key=raw_key, prefix=prefix)


@router.post("/webhooks", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new webhook endpoint for receiving transfer events."""
    secret = "whsec_" + secrets.token_urlsafe(24)
    
    endpoint = __import__("app").models.WebhookEndpoint(
        user_id=user.id,
        target_url=body.target_url,
        secret=secret
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)

    return endpoint

