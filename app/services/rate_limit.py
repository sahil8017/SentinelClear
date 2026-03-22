"""Redis-backed sliding window rate limiter."""

import logging
import time
from typing import Optional

from fastapi import HTTPException, Request, status

from app.services import cache as redis_cache

logger = logging.getLogger("sentinelclear.ratelimit")

RATE_LIMIT_PREFIX = "ratelimit:"


class RateLimiter:
    """Sliding window rate limiter backed by Redis sorted sets.

    Usage as a FastAPI dependency:
        limiter = RateLimiter(max_requests=10, window_seconds=60, key_func="ip")

        @router.post("/login")
        async def login(request: Request, _=Depends(limiter)):
            ...
    """

    def __init__(self, max_requests: int, window_seconds: int, key_func: str = "ip"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.key_func = key_func  # "ip" or "user"

    async def __call__(self, request: Request) -> None:
        if redis_cache._pool is None:
            return  # Redis unavailable → fail open

        if self.key_func == "ip":
            identifier = request.client.host if request.client else "unknown"
        else:
            # For user-based limiting, extract from auth header
            auth = request.headers.get("authorization", "")
            identifier = auth[-16:] if auth else "anon"

        key = f"{RATE_LIMIT_PREFIX}{request.url.path}:{identifier}"
        now = time.time()
        window_start = now - self.window_seconds

        pipe = redis_cache._pool.pipeline()
        try:
            # Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current window
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set TTL on the key
            pipe.expire(key, self.window_seconds)
            results = await pipe.execute()

            current_count = results[1]

            if current_count >= self.max_requests:
                retry_after = int(self.window_seconds - (now - window_start))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window_seconds}s.",
                    headers={"Retry-After": str(max(1, retry_after))},
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Rate limit check failed (allowing request): %s", exc)


# Pre-configured limiters
login_limiter = RateLimiter(max_requests=10, window_seconds=60, key_func="ip")
register_limiter = RateLimiter(max_requests=5, window_seconds=60, key_func="ip")
transfer_limiter = RateLimiter(max_requests=30, window_seconds=60, key_func="user")
