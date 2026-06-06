"""Notifications router — CRUD for in-app notifications + device token registration."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.database import get_supabase
from app.utils.auth_utils import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# --- Schemas ---

class RegisterTokenRequest(BaseModel):
    fcm_token: str
    device_type: str = "android"


# --- Endpoints ---

@router.get("/pending")
async def get_pending_notifications(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get notifications not yet spoken aloud by Whispr (for TTS polling)."""
    supabase = get_supabase()
    response = (
        supabase.table("notifications")
        .select("*")
        .eq("target_user_id", current_user["id"])
        .eq("is_spoken", False)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data


@router.get("/all")
async def get_all_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Get all notifications for the current user (paginated)."""
    supabase = get_supabase()
    response = (
        supabase.table("notifications")
        .select("*")
        .eq("target_user_id", current_user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return response.data


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get the count of notifications not yet read by the user (badge display)."""
    supabase = get_supabase()
    response = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("target_user_id", current_user["id"])
        .eq("is_read", False)
        .execute()
    )
    return {"unread_count": response.count or 0}


@router.post("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a single notification as read."""
    supabase = get_supabase()

    # Verify ownership
    check = (
        supabase.table("notifications")
        .select("id")
        .eq("id", notification_id)
        .eq("target_user_id", current_user["id"])
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Notification not found")

    result = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .execute()
    )
    return result.data[0] if result.data else {"message": "Marked as read"}


@router.post("/mark-all-read")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for the current user."""
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq(
        "target_user_id", current_user["id"]
    ).eq("is_read", False).execute()
    return {"message": "All notifications marked as read"}


@router.post("/{notification_id}/mark-spoken")
async def mark_notification_spoken(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as spoken by Whispr (for audit/dedup)."""
    supabase = get_supabase()

    check = (
        supabase.table("notifications")
        .select("id")
        .eq("id", notification_id)
        .eq("target_user_id", current_user["id"])
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=404, detail="Notification not found")

    result = (
        supabase.table("notifications")
        .update({"is_spoken": True})
        .eq("id", notification_id)
        .execute()
    )
    return result.data[0] if result.data else {"message": "Marked as spoken"}


# --- Device Token Management ---

@router.post("/register-token")
async def register_device_token(
    req: RegisterTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Register or update an FCM device token for push notifications."""
    supabase = get_supabase()
    result = (
        supabase.table("device_tokens")
        .upsert(
            {
                "user_id": current_user["id"],
                "fcm_token": req.fcm_token,
                "device_type": req.device_type,
                "is_active": True,
            },
            on_conflict="user_id,fcm_token",
        )
        .execute()
    )
    return {"message": "Device token registered", "data": result.data[0] if result.data else None}


@router.delete("/unregister-token")
async def unregister_device_token(
    fcm_token: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Deactivate an FCM device token (e.g. on logout)."""
    supabase = get_supabase()
    supabase.table("device_tokens").update({"is_active": False}).eq(
        "user_id", current_user["id"]
    ).eq("fcm_token", fcm_token).execute()
    return {"message": "Device token deactivated"}
