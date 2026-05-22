"""Voice interaction logging router — audit trail for Whispr AI."""

from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.database import get_supabase
from app.utils.auth_utils import get_current_user

router = APIRouter(prefix="/api/voice", tags=["voice"])


class VoiceLogRequest(BaseModel):
    interaction_type: str  # LEAVE_APPLY, LEAVE_APPROVE, LEAVE_REJECT, QUERY
    spoken_input: Optional[str] = None
    parsed_intent: Optional[dict] = None
    whispr_response: Optional[str] = None
    action_taken: Optional[dict] = None


@router.post("/log")
async def log_voice_interaction(
    req: VoiceLogRequest,
    current_user: dict = Depends(get_current_user),
):
    """Log a voice interaction from the Whispr AI assistant for audit purposes."""
    supabase = get_supabase()

    log_entry = {
        "user_id": current_user["id"],
        "employee_id": current_user.get("employee_id"),
        "interaction_type": req.interaction_type,
        "spoken_input": req.spoken_input,
        "parsed_intent": req.parsed_intent,
        "whispr_response": req.whispr_response,
        "action_taken": req.action_taken,
    }

    result = supabase.table("voice_interaction_log").insert(log_entry).execute()
    return result.data[0] if result.data else {"message": "Voice interaction logged"}


@router.get("/logs")
async def get_voice_logs(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Get recent voice interaction logs (admin sees all, employee sees own)."""
    supabase = get_supabase()
    query = supabase.table("voice_interaction_log").select("*")

    # Non-admin users only see their own logs
    if current_user.get("role") == "EMPLOYEE":
        query = query.eq("user_id", current_user["id"])

    response = query.order("created_at", desc=True).limit(limit).execute()
    return response.data
