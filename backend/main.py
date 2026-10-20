
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from supabase import Client, create_client


# Load environment variables from backend/.env
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Create the Supabase client only when credentials are configured.
supabase_client: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SECRET_KEY:
    supabase_client = create_client(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY,
    )


app = FastAPI(
    title="Cold Call Guide API",
    description="Backend API for the Live Cold Call Guide",
    version="0.1.0",
)


@app.get("/")
def home():
    return {
        "message": "Cold Call Guide API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "cold-call-guide-api",
    }


@app.get("/db-health")
def database_health_check():
    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    try:
        # Run a small read-only query to check database connectivity.
        supabase_client.table("calls").select("id").limit(1).execute()

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        # Do not expose credentials or internal errors to API clients.
        raise HTTPException(
            status_code=503,
            detail="Supabase connection failed. Check backend configuration.",
        ) from exc
