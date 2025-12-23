from fastapi import Request
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
import os

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not set")

class UserContext:
    def __init__(
        self,
        *,
        user_id: str,
        role: str,
        store_id: str | None = None,
        supplier_id: str | None = None,
        user_email: str
    ):
        self.user_id = user_id
        self.role = role
        self.store_id = store_id
        self.supplier_id = supplier_id
        self.user_email = user_email


async def jwt_auth_middleware(request: Request, call_next):
    auth_header = request.headers.get("Authorization")

    # Default: unauthenticated
    request.state.user = None

    if not auth_header or not auth_header.startswith("Bearer "):
        return await call_next(request)

    token = auth_header.split(" ")[1]

    try:
        payload = jwt.get_unverified_claims(token)

        request.state.user = UserContext(
            user_id=payload["sub"],
            role=payload["globalRole"],
            store_id=payload.get("storeId"),
            supplier_id=payload.get("supplierId"),
            user_email=payload.get("email")
        )

    except JWTError:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or expired token"},
        )

    return await call_next(request)
