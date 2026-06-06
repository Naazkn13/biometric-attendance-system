"""Notification service — creates notifications and triggers push."""

import logging
from datetime import date
from typing import Optional, List
from app.database import get_supabase

logger = logging.getLogger(__name__)


def _format_date_spoken(d: date) -> str:
    """Format a date for natural-sounding TTS output.

    Returns strings like 'May 23rd' or 'tomorrow' when applicable.
    """
    from datetime import datetime
    from app.utils.timezone import to_local
    import pytz

    today = to_local(datetime.now(pytz.utc)).date()
    delta = (d - today).days

    if delta == 0:
        return "today"
    elif delta == 1:
        return "tomorrow"
    elif delta == -1:
        return "yesterday"

    day = d.day
    if 11 <= day <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")

    return f"{d.strftime('%B')} {day}{suffix}"


def _format_date_range_spoken(start: date, end: date) -> str:
    """Format a date range for TTS: 'May 23rd to May 25th'."""
    if start == end:
        return _format_date_spoken(start)
    return f"{_format_date_spoken(start)} to {_format_date_spoken(end)}"


def _get_employee_name(employee_id: str) -> str:
    """Look up employee name by ID."""
    supabase = get_supabase()
    resp = supabase.table("employees").select("name").eq("id", employee_id).execute()
    if resp.data:
        return resp.data[0]["name"]
    return "An employee"


def _get_user_name(user_id: str) -> str:
    """Look up user display name (via linked employee) by user ID."""
    supabase = get_supabase()
    resp = (
        supabase.table("users")
        .select("username, employee_id, employees(name)")
        .eq("id", user_id)
        .execute()
    )
    if resp.data:
        user = resp.data[0]
        if user.get("employees") and user["employees"].get("name"):
            return user["employees"]["name"]
        return user.get("username", "Someone")
    return "Someone"


def _get_admin_user_ids() -> List[str]:
    """Get all active ADMIN and SUPERADMIN user IDs."""
    supabase = get_supabase()
    resp = (
        supabase.table("users")
        .select("id")
        .in_("role", ["ADMIN", "SUPERADMIN"])
        .eq("is_active", True)
        .execute()
    )
    return [u["id"] for u in (resp.data or [])]


def _get_user_id_for_employee(employee_id: str) -> Optional[str]:
    """Find the user account linked to an employee."""
    supabase = get_supabase()
    resp = (
        supabase.table("users")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("is_active", True)
        .execute()
    )
    if resp.data:
        return resp.data[0]["id"]
    return None


def _get_all_active_user_ids() -> List[str]:
    """Get every active user ID (all roles) — used for team-wide broadcasts."""
    supabase = get_supabase()
    resp = (
        supabase.table("users")
        .select("id")
        .eq("is_active", True)
        .execute()
    )
    return [u["id"] for u in (resp.data or [])]


def create_notification(
    target_user_id: str,
    notification_type: str,
    title: str,
    spoken_message: str,
    related_entity_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
) -> Optional[dict]:
    """Insert a notification row. Supabase Realtime broadcasts it automatically."""
    supabase = get_supabase()
    try:
        result = supabase.table("notifications").insert({
            "target_user_id": target_user_id,
            "notification_type": notification_type,
            "title": title,
            "spoken_message": spoken_message,
            "related_entity_id": related_entity_id,
            "related_entity_type": related_entity_type,
        }).execute()
        logger.info(
            f"Notification created: type={notification_type} target={target_user_id}"
        )
        return result.data[0] if result.data else None
    except Exception as exc:
        logger.error(f"Failed to create notification: {exc}")
        return None


def notify_admins_leave_request(
    employee_id: str,
    leave_id: str,
    leave_date: date,
    leave_end_date: Optional[date] = None,
) -> None:
    """Notify all admins that an employee submitted a leave request."""
    name = _get_employee_name(employee_id)
    end = leave_end_date or leave_date
    date_str = _format_date_range_spoken(leave_date, end)

    if leave_date == end:
        spoken = (
            f"{name} has requested a leave for {date_str}. "
            "Would you like to approve or reject?"
        )
    else:
        days = (end - leave_date).days + 1
        spoken = (
            f"{name} has requested {days} days of leave from {date_str}. "
            "Would you like to approve or reject?"
        )

    for admin_id in _get_admin_user_ids():
        create_notification(
            target_user_id=admin_id,
            notification_type="LEAVE_REQUEST",
            title=f"Leave request from {name}",
            spoken_message=spoken,
            related_entity_id=leave_id,
            related_entity_type="leave_request",
        )


def notify_employee_leave_approved(
    employee_id: str,
    leave_id: str,
    leave_date: date,
    leave_end_date: Optional[date],
    approved_by_user_id: str,
) -> None:
    """Notify the employee that their leave was approved."""
    user_id = _get_user_id_for_employee(employee_id)
    if not user_id:
        logger.warning(f"No user account for employee {employee_id}, skipping notification")
        return

    approver = _get_user_name(approved_by_user_id)
    end = leave_end_date or leave_date
    date_str = _format_date_range_spoken(leave_date, end)

    spoken = f"Good news! Your leave for {date_str} has been approved by {approver}."

    create_notification(
        target_user_id=user_id,
        notification_type="LEAVE_APPROVED",
        title="Leave approved",
        spoken_message=spoken,
        related_entity_id=leave_id,
        related_entity_type="leave_request",
    )


def notify_employee_leave_rejected(
    employee_id: str,
    leave_id: str,
    leave_date: date,
    leave_end_date: Optional[date],
    rejected_by_user_id: str,
    rejection_reason: str,
) -> None:
    """Notify the employee that their leave was rejected."""
    user_id = _get_user_id_for_employee(employee_id)
    if not user_id:
        logger.warning(f"No user account for employee {employee_id}, skipping notification")
        return

    rejector = _get_user_name(rejected_by_user_id)
    end = leave_end_date or leave_date
    date_str = _format_date_range_spoken(leave_date, end)

    spoken = (
        f"Your leave for {date_str} has been rejected by {rejector}. "
        f"Reason: {rejection_reason}"
    )

    create_notification(
        target_user_id=user_id,
        notification_type="LEAVE_REJECTED",
        title="Leave rejected",
        spoken_message=spoken,
        related_entity_id=leave_id,
        related_entity_type="leave_request",
    )


def notify_all_employees_leave_approved(
    employee_name: str,
    leave_date: date,
    leave_end_date: Optional[date],
    leave_id: str,
) -> None:
    """Broadcast a voice notification to EVERY active user when a leave is approved.

    This lets the whole team know — spoken aloud by Whispr on each device —
    so everyone plans accordingly (e.g. "Asifa is on leave on 9th June").
    """
    end = leave_end_date or leave_date
    date_str = _format_date_range_spoken(leave_date, end)
    first_name = employee_name.split()[0]

    spoken = f"{first_name} is on leave on {date_str}. Please plan accordingly."
    title = f"{first_name} is on leave"

    for user_id in _get_all_active_user_ids():
        create_notification(
            target_user_id=user_id,
            notification_type="LEAVE_TEAM_BROADCAST",
            title=title,
            spoken_message=spoken,
            related_entity_id=leave_id,
            related_entity_type="leave_request",
        )
