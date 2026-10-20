
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, create_client

# -----------------------------------------------------------------------------------------------------------------

# Load backend/.env
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

# -----------------------------------------------------------------------------------------------------------------

class StartCallRequest(BaseModel):
    prospect_name: Optional[str] = Field(default=None, max_length=200)
    company_name: Optional[str] = Field(default=None, max_length=200)
    prospect_role: Optional[str] = Field(default=None, max_length=200)


class SaveStageRequest(BaseModel):
    stage_number: int = Field(ge=1, le=8)
    selected_actions: list[str] = Field(default_factory=list)
    prospect_words: Optional[str] = Field(default=None, max_length=5000)
    

class EndCallRequest(BaseModel):
    outcome: str = Field(min_length=1, max_length=100)
    summary: Optional[str] = Field(default=None, max_length=5000)


# -----------------------------------------------------------------------------------------------------------------

@app.get("/")
def home():
    return {"message": "Cold Call Guide API is running"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "cold-call-guide-api",
    }

# -----------------------------------------------------------------------------------------------------------------

@app.get("/db-health")
def database_health_check():
    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    try:
        supabase_client.table("calls").select("id").limit(1).execute()
        return {"status": "ok", "database": "connected"}

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Supabase connection failed. Check backend configuration.",
        ) from exc

# -----------------------------------------------------------------------------------------------------------------
@app.post("/calls", status_code=201)
def start_call(request: StartCallRequest):
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
            supabase_client.table("calls")
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
# -----------------------------------------------------------------------------------------------------------------

@app.post("/calls/{call_id}/stages")
def save_stage_result(call_id: UUID, request: SaveStageRequest):
    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    try:
        # Find the call before saving its stage result.
        call_response = (
            supabase_client.table("calls")
            .select("id, status, last_stage_reached")
            .eq("id", str(call_id))
            .execute()
        )

        if not call_response.data:
            raise HTTPException(
                status_code=404,
                detail="Call not found.",
            )

        call_record = call_response.data[0]

        if call_record["status"] == "completed":
            raise HTTPException(
                status_code=409,
                detail="This call is already completed.",
            )

        now = datetime.now(timezone.utc).isoformat()

        stage_data = {
            "call_id": str(call_id),
            "stage_number": request.stage_number,
            "selected_actions": request.selected_actions,
            "prospect_words": request.prospect_words,
            "updated_at": now,
        }

        # Insert the result or update it if this stage was saved before.
        stage_response = (
            supabase_client.table("stage_results")
            .upsert(
                stage_data,
                on_conflict="call_id,stage_number",
            )
            .execute()
        )

        if not stage_response.data:
            raise HTTPException(
                status_code=500,
                detail="The stage result could not be saved.",
            )

        # Keep the highest stage reached, even when revisiting an earlier stage.
        highest_stage = max(
            int(call_record.get("last_stage_reached") or 1),
            request.stage_number,
        )

        (
            supabase_client.table("calls")
            .update({
                "last_stage_reached": highest_stage,
                "updated_at": now,
            })
            .eq("id", str(call_id))
            .execute()
        )

        return {
            "message": "Stage result saved successfully",
            "stage_result": stage_response.data[0],
            "last_stage_reached": highest_stage,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save the stage result. Check backend logs.",
        ) from exc
        
# -----------------------------------------------------------------------------------------------------------------

@app.post("/calls/{call_id}/end")
def end_call(call_id: UUID, request: EndCallRequest):
    """Complete a call and save its final outcome."""

    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    try:
        # Confirm that the call exists.
        call_response = (
            supabase_client.table("calls")
            .select("id, status")
            .eq("id", str(call_id))
            .execute()
        )

        if not call_response.data:
            raise HTTPException(
                status_code=404,
                detail="Call not found.",
            )

        call_record = call_response.data[0]

        if call_record["status"] == "completed":
            raise HTTPException(
                status_code=409,
                detail="This call has already been completed.",
            )

        ended_at = datetime.now(timezone.utc).isoformat()

        # Save the final outcome and completion timestamp.
        update_response = (
            supabase_client.table("calls")
            .update({
                "status": "completed",
                "ended_at": ended_at,
                "outcome": request.outcome,
                "summary": request.summary,
                "updated_at": ended_at,
            })
            .eq("id", str(call_id))
            .execute()
        )

        if not update_response.data:
            raise HTTPException(
                status_code=500,
                detail="The call could not be completed.",
            )

        return {
            "message": "Call completed successfully",
            "call": update_response.data[0],
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to complete the call. Check backend logs.",
        ) from exc
        
# -----------------------------------------------------------------------------------------------------------------

@app.get("/calls")
def get_calls():
    """Retrieve recent calls for the Past Calls screen."""

    if supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase credentials are not configured.",
        )

    try:
        response = (
            supabase_client
            .table("calls")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        return {
            "count": len(response.data),
            "calls": response.data,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve calls. Check backend logs.",
        ) from exc




