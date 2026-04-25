import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = logging.getLogger("sentinelclear.sla")

class SLAMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        response.headers["X-Response-Time"] = f"{duration:.3f}s"

        path = request.url.path
        
        if path.startswith("/transfers") and duration > 2.0:
            logger.warning(f"SLA Violation: {path} took {duration:.3f}s (Threshold: 2.0s)")
        elif path == "/health" and duration > 0.5:
            logger.warning(f"SLA Violation: {path} took {duration:.3f}s (Threshold: 0.5s)")
        elif path == "/fraud/dashboard" and duration > 3.0:
            logger.warning(f"SLA Violation: {path} took {duration:.3f}s (Threshold: 3.0s)")
            
        return response
