
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client


# Load environment variables from backend/.env
BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

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


# Request model for starting a call
class StartCallRequest(BaseModel):
    prospect_name: Optional[str] = Field(default=None, max_length=200)
    company_name: Optional[str] = Field(default=None, max_length=200)
    prospect_role: Optional[str] = Field(default=None, max_length=200)


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
        supabase_client.table("calls").select("id").limit(1).execute()

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Supabase connection failed. Check backend configuration.",
        ) from exc


@app.post("/calls", status_code=201)
def start_call(request: StartCallRequest):
    """Create a new call record in Supabase."""

    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    call_data = {
        "prospect_name": request.prospect_name,
        "company_name": request.company_name,
        "prospect_role": request.prospect_role,
        "last_stage_reached": 1,
        "status": "in_progress",
    }

    try:
        response = (
            supabase_client
            .table("calls")
            .insert(call_data)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="The call could not be created.",
            )

        return {
            "message": "Call started successfully",
            "call": response.data[0],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to start the call. Check backend logs.",
        ) from exc
