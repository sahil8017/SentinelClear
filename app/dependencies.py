"""JWT authentication dependency for FastAPI."""

from fastapi import Depends, Header, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib

from app.config import settings
from app.database import get_db, get_read_db
from app.models import User, ApiKey

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated User, or raise 401."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        import os
        with open(os.path.join("keys", "jwt_public.pem"), "r") as f:
            public_key = f.read()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
        )
        user_id: int | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_current_user_read(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_read_db),
) -> User:
    """Read-only version of get_current_user to offload primary DB."""
    return await get_current_user(credentials=credentials, db=db)


async def require_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Decode JWT, verify ADMIN role, and confirm user still exists in DB."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        import os
        with open(os.path.join("keys", "jwt_public.pem"), "r") as f:
            public_key = f.read()
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
        )
        role: str | None = payload.get("role")
        user_id: int | None = payload.get("sub")
        if role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator access required.",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Verify user still exists in DB and role hasn't been revoked
    if user_id is not None:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin user no longer exists",
            )
        if user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges have been revoked.",
            )

    return token

async def verify_api_key(
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Verify X-API-Key header against database and return User."""
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key required",
        )
    prefix = x_api_key[:8]
    hashed_key = hashlib.sha256(x_api_key.encode()).hexdigest()
    
    result = await db.execute(
        select(ApiKey).where(ApiKey.prefix == prefix, ApiKey.hashed_key == hashed_key)
    )
    api_key_record = result.scalar_one_or_none()
    
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key",
        )
        
    result = await db.execute(select(User).where(User.id == api_key_record.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key user not found",
        )
    return user


async def get_user_or_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Authenticates via Bearer JWT OR X-API-Key header."""
    if credentials:
        return await get_current_user(credentials=credentials, db=db)
    elif x_api_key:
        return await verify_api_key(x_api_key=x_api_key, db=db)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide Bearer token or X-API-Key header",
        )


async def get_user_or_api_key_read(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_read_db)
) -> User:
    """Read-only version of get_user_or_api_key."""
    return await get_user_or_api_key(credentials=credentials, x_api_key=x_api_key, db=db)

def require_permission(resource: str, action: str):
    """RBAC permission checker — lazy-imports models to avoid startup crash."""
    async def permission_checker(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        if user.role == "ADMIN":
            return user

        # Lazy import: these models may not exist yet
        try:
            from app.models import Role, Permission, RolePermission, UserRole
        except ImportError:
            raise HTTPException(status_code=501, detail="RBAC not configured")

        stmt = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(UserRole.user_id == user.id)
            .where(Permission.resource == resource)
            .where(Permission.action == action)
        )
        result = await db.execute(stmt)
        if not result.scalars().first():
            raise HTTPException(status_code=403, detail=f"Permission denied: {action} on {resource}")
        return user
    return permission_checker

