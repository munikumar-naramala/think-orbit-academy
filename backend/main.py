import os
import time
import secrets
from typing import Any, Dict, Optional
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

app = FastAPI(title="ThinkOrbit Academy - Auth")

# Load environment from .env if present. First try the current working directory,
# then try the project root (one level up from backend/).
load_dotenv()
root_env = Path(__file__).resolve().parents[1] / ".env"
if root_env.exists():
    load_dotenv(root_env)

# Expect the Google OAuth2 client ID to be set via environment variable
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

# CORS configuration - allow local dev origins by default or set CORS_ORIGINS env var (comma-separated)
cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class TokenPayload(BaseModel):
    id_token: str


def verify_id_token(token: str) -> dict:
    """Verify the provided Google ID token and return decoded payload or raise HTTPException."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured on server")
    try:
        request = grequests.Request()
        id_info = id_token.verify_oauth2_token(token, request, GOOGLE_CLIENT_ID)
        return id_info
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


@app.post("/verify_token")
async def verify_token(payload: TokenPayload) -> Any:
    """Verify a Google ID token and return the decoded payload.

    This uses google.oauth2.id_token.verify_oauth2_token which verifies
    the token's signature and expiry using Google's certs.
    """
    id_info = verify_id_token(payload.id_token)
    return {"verified": True, "payload": id_info}


# Simple in-memory session store: { session_id: {payload, expires_at} }.
# This is suitable for development only. Use Redis or a persistent store in production.
SESSION_STORE: Dict[str, Dict[str, Any]] = {}
SESSION_TTL = int(os.environ.get("SESSION_TTL", "3600"))  # seconds


@app.post("/login")
async def login(payload: TokenPayload, response: Response) -> Any:
    """Verify ID token, create a server-side session, and set an HttpOnly session cookie.

    The cookie contains a random session id. Session data (decoded payload) is stored
    in-memory for SESSION_TTL seconds. For production replace the in-memory store with
    Redis or a database and issue a short-lived session identifier.
    """
    id_info = verify_id_token(payload.id_token)

    # create session
    session_id = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + SESSION_TTL
    SESSION_STORE[session_id] = {"payload": id_info, "expires_at": expires_at}

    # Cookie options
    cookie_name = os.environ.get("SESSION_COOKIE_NAME", "toa_token")
    secure_flag = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    response.set_cookie(
        key=cookie_name,
        value=session_id,
        httponly=True,
        secure=secure_flag,
        samesite="lax",
        path="/",
        max_age=SESSION_TTL,
    )

    return {"verified": True, "payload": id_info}


def extract_token_from_request(request: Request) -> Optional[str]:
    # Prefer Authorization header
    auth = request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    # Fallback to cookie
    cookie_name = os.environ.get("SESSION_COOKIE_NAME", "toa_token")
    return request.cookies.get(cookie_name)


@app.get("/profile")
async def profile(request: Request) -> Any:
    """Protected profile route: verifies token from Authorization header or session cookie."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing credentials")

    # If the token looks like a JWT (contains two dots) try verifying it directly.
    if token.count(".") == 2:
        id_info = verify_id_token(token)
    else:
        # treat as session id
        session = SESSION_STORE.get(token)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        if session.get("expires_at", 0) < int(time.time()):
            # expired
            SESSION_STORE.pop(token, None)
            raise HTTPException(status_code=401, detail="Session expired")
        id_info = session.get("payload")

    # Return a minimal profile
    profile = {
        "sub": id_info.get("sub"),
        "email": id_info.get("email"),
        "name": id_info.get("name"),
        "picture": id_info.get("picture"),
        "email_verified": id_info.get("email_verified"),
    }
    return {"verified": True, "profile": profile}


@app.post("/logout")
async def logout(request: Request, response: Response) -> Any:
    """Clear the session cookie set at /login and remove session from store."""
    cookie_name = os.environ.get("SESSION_COOKIE_NAME", "toa_token")
    session_id = request.cookies.get(cookie_name)
    if session_id:
        SESSION_STORE.pop(session_id, None)
    response.delete_cookie(key=cookie_name, path="/")
    return {"logged_out": True}


@app.get("/")
async def root():
    return {"message": "ThinkOrbit Academy auth service. POST /login with {id_token}."}
async def logout(response: Response) -> Any:
    """Clear the session cookie set at /login."""
    cookie_name = os.environ.get("SESSION_COOKIE_NAME", "toa_token")
    response.delete_cookie(key=cookie_name, path="/")
    return {"logged_out": True}


@app.get("/")
async def root():
    return {"message": "ThinkOrbit Academy auth service. POST /verify_token with {id_token}."}
