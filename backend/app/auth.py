import time
import requests
from fastapi import Request, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
import msal
from jose import jwt, JWTError
from app.config import (
    AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET,
    AZURE_AUTHORITY,
    AZURE_REDIRECT_URI,
    AZURE_SCOPES,
    SECRET_KEY,
    ALGORITHM,
    SESSION_COOKIE_NAME,
    REQUIRED_ROLE_ARCHITECT
)

# MSAL Confidential Client setup
def get_msal_app():
    if not AZURE_CLIENT_ID or not AZURE_CLIENT_SECRET:
        return None
    return msal.ConfidentialClientApplication(
        AZURE_CLIENT_ID,
        authority=AZURE_AUTHORITY,
        client_secret=AZURE_CLIENT_SECRET
    )

# Fetch Microsoft public keys for JWT validation
def get_azure_public_keys():
    try:
        keys_url = f"{AZURE_AUTHORITY}/discovery/v2.0/keys"
        response = requests.get(keys_url, timeout=5)
        return response.json()
    except Exception as e:
        print(f"Error fetching Azure public keys: {e}")
        return None

def generate_local_session_token(user_info: dict) -> str:
    """Generate a JWT token for the local user session cookie"""
    payload = {
        **user_info,
        "exp": time.time() + 86400  # 24 hours expiry
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_local_session_token(token: str) -> dict:
    """Decode and validate the local session token"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalide ou expirée"
        )

# Get current user from secure session cookie
def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    
    # If Azure configuration is missing, allow a mock local developer session
    if not AZURE_CLIENT_ID or not AZURE_CLIENT_SECRET:
            "name": "Architecte (Dev Mode)",
            "email": "architecte@local.dev",
            "roles": [REQUIRED_ROLE_ARCHITECT, "Admins"],
            "mock": True
        }

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non authentifié"
        )
        
    return decode_local_session_token(session_token)

# Role check dependency
def require_architect(user: dict = Depends(get_current_user)):
    # In mock mode, grant access automatically
    if user.get("mock"):
        return user
        
    roles = user.get("roles", [])
    groups = user.get("groups", [])
    
    # Check if the architect group or role is present
    if REQUIRED_ROLE_ARCHITECT in roles or REQUIRED_ROLE_ARCHITECT in groups:
        return user
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Action refusée. Rôle 'Architecte' requis."
    )

def require_admin(user: dict = Depends(get_current_user)):
    # In mock mode, grant access automatically
    if user.get("mock"):
        return user
        
    roles = user.get("roles", [])
    groups = user.get("groups", [])
    
    if "Admins" in roles or "Admins" in groups:
        return user
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Action refusée. Rôle 'Administrateur' requis."
    )
