"""Auth router — register, login, and robust Firebase integrations."""

import logging
from decimal import Decimal
logger = logging.getLogger("auth")

import asyncio
import os
import re
import secrets
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

def get_or_generate_rsa_keys():
    keys_dir = "keys"
    private_key_path = os.path.join(keys_dir, "jwt_private.pem")
    public_key_path = os.path.join(keys_dir, "jwt_public.pem")
    os.makedirs(keys_dir, exist_ok=True)

    if not os.path.exists(private_key_path) or not os.path.exists(public_key_path):
        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        with open(private_key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        with open(public_key_path, "wb") as f:
            f.write(private_key.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))

    with open(private_key_path, "r") as f:
        priv_key = f.read()
    with open(public_key_path, "r") as f:
        pub_key = f.read()
    return priv_key, pub_key

PRIVATE_KEY, PUBLIC_KEY = get_or_generate_rsa_keys()
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from app.config import settings
from app.database import get_db, get_read_db
from app.models import User, Account, ApiKey, WebhookEndpoint
from app.schemas import (
    TokenResponse, UserLogin, UserOut, UserRegister,
    ApiKeyResponse, WebhookCreate, WebhookOut
)
from app.dependencies import get_current_user, get_current_user_read
from app.services.rate_limit import login_limiter, register_limiter

# Natively initialize Firebase Admin context.
# Prefer an explicit credential path from GOOGLE_APPLICATION_CREDENTIALS.
_firebase_available = False
if not firebase_admin._apps:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "service-account.json")
    if not os.path.isfile(credentials_path):
        logger.warning(
            "Firebase Admin credentials file not found at '%s'. "
            "Firebase SSO login will be unavailable. Set GOOGLE_APPLICATION_CREDENTIALS "
            "or place service-account.json in the project root.",
            credentials_path,
        )
    else:
        try:
            firebase_admin.initialize_app(credentials.Certificate(credentials_path))
            _firebase_available = True
        except Exception as e:
            logger.warning("Firebase Admin initialization failed: %s — SSO login disabled", e)
else:
    _firebase_available = True

router = APIRouter(prefix="/auth", tags=["Authentication"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class FirebaseLoginRequest(BaseModel):
    token: str = Field(..., description="Firebase ID Token explicitly received via Frontend popup")

def _create_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expire},
        PRIVATE_KEY,
        algorithm="RS256",
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
    account = Account(owner_id=user.id, account_type="savings", balance=Decimal("0.00"))
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
    logger.info("Login attempt for identifier: %s***", body.username[:3] if len(body.username) > 3 else "***")
    result = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.username))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        logger.warning("Login failed: user not found (identifier redacted)")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not pwd_context.verify(body.password, user.hashed_password):
        logger.warning("Login failed: password mismatch for user_id=%s", user.id)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    logger.info("Login successful for user_id=%s", user.id)
    return TokenResponse(access_token=_create_token(user.id, user.role))

import time
import httpx

_google_certs_cache = {}
_google_certs_expires_at = 0

async def get_google_public_certs() -> dict:
    global _google_certs_cache, _google_certs_expires_at
    now = time.time()
    if _google_certs_cache and now < _google_certs_expires_at:
        return _google_certs_cache

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com")
            if res.status_code == 200:
                _google_certs_cache = res.json()
                cache_control = res.headers.get("Cache-Control", "")
                max_age = 3600
                match = re.search(r"max-age=(\d+)", cache_control)
                if match:
                    max_age = int(match.group(1))
                _google_certs_expires_at = now + max_age
                return _google_certs_cache
    except Exception as e:
        logger.error("Failed to fetch Google public certificates: %s", e)
        if _google_certs_cache:
            return _google_certs_cache
        raise e
    return {}

async def verify_firebase_token_manually(token: str) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise ValueError("Firebase ID token lacks key ID 'kid' in header.")
        
        certs = await get_google_public_certs()
        cert_pem = certs.get(kid)
        if not cert_pem:
            raise ValueError("Firebase ID token signed by an unknown key.")
        
        project_id = "sentinelclear-76442"
        decoded = jwt.decode(
            token,
            cert_pem,
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            algorithms=["RS256"]
        )
        return decoded
    except Exception as e:
        raise ValueError(f"Manual signature validation failed: {str(e)}")

@router.post("/firebase-login", response_model=TokenResponse)
async def firebase_login(
    body: FirebaseLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _rate: None = Depends(login_limiter),
):
    """Complete Zero-Trust Verification executing the raw Firebase ID natively."""
    decoded_token = None
    if _firebase_available:
        try:
            # 1. Decode and verify signature asynchronously against Google's public instances
            decoded_token = await asyncio.to_thread(firebase_auth.verify_id_token, body.token)
        except Exception as e:
            logger.warning("Firebase Admin SDK verification failed: %s. Falling back to manual verification.", e)

    if not decoded_token:
        try:
            # Fallback to manual verification using public keys
            decoded_token = await verify_firebase_token_manually(body.token)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Firebase verification failure: {str(e)}")

    email = decoded_token.get("email")
    uid = decoded_token.get("uid") or decoded_token.get("sub")


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
        account = Account(owner_id=user.id, account_type="savings", balance=Decimal("0.00"))
        db.add(account)
        await db.commit()

    # 4. Map internally executing correct context Token issuing bridging Sentinel infrastructure seamlessly
    return TokenResponse(access_token=_create_token(user.id, user.role))

# ────────────────────────────── Profile Onboarding ──────────────────────────────

class ProfileSetupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: str = Field(..., description="ISO date string YYYY-MM-DD")
    occupation: str = Field(..., min_length=2, max_length=100)
    transaction_pin: str = Field(None, min_length=4, max_length=6, description="Optional: set transaction PIN")


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
    hashed_key = hashlib.sha256(raw_key.encode()).hexdigest()

    api_key_record = ApiKey(
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
    
    endpoint = WebhookEndpoint(
        user_id=user.id,
        target_url=body.target_url,
        secret=secret
    )
    db.add(endpoint)
    await db.commit()
    await db.refresh(endpoint)

    return endpoint


# ────────────────────────────── Transaction PIN (Step-Up Auth) ──────────────────────────────


class TransactionPinSet(BaseModel):
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$",
                     description="4 or 6-digit numeric PIN")


class TransactionPinStatus(BaseModel):
    has_pin: bool
    message: str


@router.post("/transaction-pin", response_model=TransactionPinStatus)
async def set_transaction_pin(
    body: TransactionPinSet,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or update the user's transaction PIN for Step-Up Authentication.

    The PIN is bcrypt-hashed and never stored in plaintext.
    """
    user.transaction_pin_hash = pwd_context.hash(body.pin)
    await db.commit()
    logger.info(f"Transaction PIN set for user {user.id}")
    return TransactionPinStatus(
        has_pin=True,
        message="Transaction PIN configured successfully."
    )


@router.get("/transaction-pin/status", response_model=TransactionPinStatus)
async def get_pin_status(
    user: User = Depends(get_current_user),
):
    """Check whether the current user has a transaction PIN configured."""
    has_pin = bool(user.transaction_pin_hash)
    return TransactionPinStatus(
        has_pin=has_pin,
        message="PIN is configured." if has_pin else "No transaction PIN set. Please configure one."
    )


# ────────────────────────────── Unified Profile & UPI Safety ──────────────────────────────


from app.schemas import ProfileUpdate, ProfileOut, TrustedPersonSet, TrustedPersonResponse


def _build_profile_out(user, trusted_username=None):
    """Build a unified ProfileOut from a User model instance."""
    return ProfileOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role or "USER",
        full_name=user.full_name,
        date_of_birth=str(user.date_of_birth) if user.date_of_birth else None,
        occupation=user.occupation,
        profile_complete=user.profile_complete if hasattr(user, 'profile_complete') else False,
        is_disabled=user.is_disabled if hasattr(user, 'is_disabled') else False,
        trusted_person_username=trusted_username,
        kill_switch_active=user.kill_switch_active,
        created_at=user.created_at,
    )


async def _resolve_trusted(user, db):
    """Resolve trusted person username from user model."""
    if user.trusted_person_id:
        tp_result = await db.execute(select(User).where(User.id == user.trusted_person_id))
        tp = tp_result.scalar_one_or_none()
        if tp:
            return tp.username
    return None


@router.get("/profile", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user_read),
    db: AsyncSession = Depends(get_read_db),
):
    """Return the authenticated user's complete profile."""
    await db.refresh(user)
    trusted_username = await _resolve_trusted(user, db)
    return _build_profile_out(user, trusted_username)


class ProfilePatchRequest(BaseModel):
    full_name: str | None = None
    occupation: str | None = None
    date_of_birth: str | None = None
    is_disabled: bool | None = None
    profile_complete: bool | None = None


@router.patch("/profile", response_model=ProfileOut)
async def patch_profile(
    body: ProfilePatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partial profile update — only modifies provided fields."""
    from datetime import date as date_type

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.occupation is not None:
        user.occupation = body.occupation
    if body.date_of_birth is not None:
        try:
            user.date_of_birth = date_type.fromisoformat(body.date_of_birth)
        except ValueError:
            pass
    if body.is_disabled is not None:
        user.is_disabled = body.is_disabled
    if body.profile_complete is not None:
        user.profile_complete = body.profile_complete

    await db.commit()
    await db.refresh(user)
    trusted_username = await _resolve_trusted(user, db)
    return _build_profile_out(user, trusted_username)


@router.put("/profile", response_model=ProfileOut)
async def update_profile_full(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full profile update — onboarding and UPI Safety fields."""
    from datetime import date as date_type

    if body.date_of_birth is not None:
        if isinstance(body.date_of_birth, str):
            try:
                user.date_of_birth = date_type.fromisoformat(body.date_of_birth)
            except ValueError:
                pass
        else:
            user.date_of_birth = body.date_of_birth
    if body.is_disabled is not None:
        user.is_disabled = body.is_disabled

    await db.commit()
    await db.refresh(user)
    trusted_username = await _resolve_trusted(user, db)
    return _build_profile_out(user, trusted_username)


@router.put("/trusted-person", response_model=TrustedPersonResponse)
async def set_trusted_person(
    body: TrustedPersonSet,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Designate a trusted person (guardian) for high-value transaction approvals.

    UPI Safety Rule 2: For users aged ≥70 or with disabilities, transactions
    above ₹50,000 require approval from this trusted person.
    """
    # Find the trusted person by username
    result = await db.execute(select(User).where(User.username == body.username))
    trusted_person = result.scalar_one_or_none()

    if not trusted_person:
        raise HTTPException(status_code=404, detail=f"User '{body.username}' not found")

    if trusted_person.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot designate yourself as your trusted person")

    user.trusted_person_id = trusted_person.id
    await db.commit()

    return TrustedPersonResponse(
        trusted_person_id=trusted_person.id,
        trusted_person_username=trusted_person.username,
        message=f"Trusted person set to '{trusted_person.username}'. They will be notified for high-value approvals.",
    )


@router.delete("/trusted-person", response_model=TrustedPersonResponse)
async def remove_trusted_person(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the designated trusted person."""
    user.trusted_person_id = None
    await db.commit()

    return TrustedPersonResponse(
        trusted_person_id=None,
        trusted_person_username=None,
        message="Trusted person removed. High-value transactions will require a guardian to be configured.",
    )
