import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DOCS_DIR = os.getenv("DOCS_DIR", str(BASE_DIR / "docs"))

# App Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "session"

# Azure Entra ID configuration (Azure Active Directory)
# These should be populated with values from the Azure Portal (App Registration)
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "common")  # Set to your Tenant ID UUID or "common"
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "")        # Set to your Application Client ID UUID
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "") # Set to your Client Secret
AZURE_REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/api/auth/callback")

AZURE_AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}"
AZURE_SCOPES = ["openid", "profile", "email", "User.Read"]

# Roles required for modifications
REQUIRED_ROLE_ARCHITECT = os.getenv("REQUIRED_ROLE_ARCHITECT", "Architects") # Azure AD Group name
