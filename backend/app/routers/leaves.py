"""Leave management router — apply, approve, reject with Whispr notifications."""

import logging
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.database import get_supabase
from app.utils.auth_utils import get_current_user, require_role
from app.services.notification_service import (
    notify_admins_leave_request,
    notify_employee_leave_approved,
    notify_employee_leave_rejected,
)
from app.services.push_service import send_push_to_admins, send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


class LeaveApplyRequest(BaseModel):
    leave_date: str
    leave_end_date: Optional[str] = None  # For multi-day leaves
    leave_type: str
    reason: str


class LeaveRejectRequest(BaseModel):
    rejection_reason: str


# --- EMPLOYEE ENDPOINTS ---

@router.post("/apply")
async def apply_leave(
    req: LeaveApplyRequest,
    current_user: dict = Depends(require_role(["EMPLOYEE", "ADMIN", "SUPERADMIN", "HM"]))
):
    supabase = get_supabase()
    employee_id = current_user.get("employee_id")

    leave_start = date.fromisoformat(req.leave_date)
    leave_end = date.fromisoformat(req.leave_end_date) if req.leave_end_date else leave_start

    # Validate date range
    if leave_end < leave_start:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    if (leave_end - leave_start).days > 30:
        raise HTTPException(status_code=400, detail="Leave request cannot exceed 30 days")

    # Check for overlapping leave requests
    response = (
        supabase.table("leave_requests")
        .select("id, leave_date, leave_end_date")
        .eq("employee_id", employee_id)
        .in_("status", ["PENDING", "APPROVED"])
        .execute()
    )

    for existing in (response.data or []):
        existing_start = date.fromisoformat(existing["leave_date"])
        existing_end = date.fromisoformat(existing["leave_end_date"]) if existing.get("leave_end_date") else existing_start
        # Check for overlap
        if leave_start <= existing_end and leave_end >= existing_start:
            raise HTTPException(
                status_code=400,
                detail=f"A leave request already exists that overlaps with these dates ({existing_start} to {existing_end})"
            )

    new_request = {
        "employee_id": employee_id,
        "leave_date": req.leave_date,
        "leave_end_date": req.leave_end_date or req.leave_date,
        "leave_type": req.leave_type,
        "reason": req.reason,
        "status": "PENDING",
    }

    result = supabase.table("leave_requests").insert(new_request).execute()
    leave_record = result.data[0]

    # Notify all admins via in-app notification (Supabase Realtime broadcasts it)
    try:
        notify_admins_leave_request(
            employee_id=employee_id,
            leave_id=leave_record["id"],
            leave_date=leave_start,
            leave_end_date=leave_end if leave_end != leave_start else None,
        )
    except Exception as exc:
        logger.error(f"Failed to notify admins: {exc}")

    # Send push notification to admins (works even if app is closed)
    try:
        from app.services.notification_service import _get_employee_name, _format_date_range_spoken
        name = _get_employee_name(employee_id)
        date_str = _format_date_range_spoken(leave_start, leave_end)
        send_push_to_admins(
            title=f"Leave request from {name}",
            body=f"{name} has requested leave for {date_str}",
            data={"type": "LEAVE_REQUEST", "leave_id": leave_record["id"]},
        )
    except Exception as exc:
        logger.error(f"Failed to send push to admins: {exc}")

    return leave_record


@router.get("/my-leaves")
async def get_my_leaves(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: dict = Depends(require_role(["EMPLOYEE", "ADMIN", "SUPERADMIN", "HM"]))
):
    supabase = get_supabase()
    employee_id = current_user.get("employee_id")

    query = supabase.table("leave_requests").select("*").eq("employee_id", employee_id)

    if year and month:
        start_date = date(year, month, 1).isoformat()
        if month == 12:
            end_date = date(year + 1, 1, 1).isoformat()
        else:
            end_date = date(year, month + 1, 1).isoformat()

        query = query.gte("leave_date", start_date).lt("leave_date", end_date)

    query = query.order("leave_date", desc=True)
    response = query.execute()
    return response.data


@router.get("/my-balance")
async def get_my_balance(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month"),
    current_user: dict = Depends(require_role(["EMPLOYEE", "ADMIN", "SUPERADMIN", "HM"]))
):
    supabase = get_supabase()
    employee_id = current_user.get("employee_id")

    response = supabase.table("leave_balances").select("*").eq("employee_id", employee_id).eq("year", year).eq("month", month).execute()

    if not response.data:
        return {
            "employee_id": employee_id,
            "year": year,
            "month": month,
            "paid_leaves_quota": 1,
            "paid_leaves_used": 0
        }

    return response.data[0]


# --- ADMIN/SUPERADMIN ENDPOINTS ---

@router.get("/pending")
async def get_pending_leaves(
    current_user: dict = Depends(require_role(["ADMIN", "SUPERADMIN"]))
):
    supabase = get_supabase()
    # Join with employees to get name
    response = supabase.table("leave_requests").select("*, employees(name, device_user_id)").eq("status", "PENDING").order("created_at", desc=False).execute()
    return response.data


@router.get("/all")
async def get_all_leaves(
    employee_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_role(["ADMIN", "SUPERADMIN"]))
):
    supabase = get_supabase()
    query = supabase.table("leave_requests").select("*, employees(name, device_user_id)")

    if employee_id:
        query = query.eq("employee_id", employee_id)
    if status:
        query = query.eq("status", status)

    if year and month:
        start_date = date(year, month, 1).isoformat()
        if month == 12:
            end_date = date(year + 1, 1, 1).isoformat()
        else:
            end_date = date(year, month + 1, 1).isoformat()

        query = query.gte("leave_date", start_date).lt("leave_date", end_date)

    query = query.order("leave_date", desc=True)
    response = query.execute()
    return response.data


# --- ADMIN / SUPERADMIN ENDPOINTS ---

@router.post("/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    current_user: dict = Depends(require_role(["ADMIN", "SUPERADMIN"]))
):
    supabase = get_supabase()

    # Get leave request
    leave_req_resp = supabase.table("leave_requests").select("*").eq("id", leave_id).execute()
    if not leave_req_resp.data:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave_req = leave_req_resp.data[0]
    if leave_req["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Leave request is already {leave_req['status']}")

    employee_id = leave_req["employee_id"]
    leave_date = date.fromisoformat(leave_req["leave_date"])
    leave_end_date = date.fromisoformat(leave_req["leave_end_date"]) if leave_req.get("leave_end_date") else leave_date

    # Calculate number of leave days
    num_days = (leave_end_date - leave_date).days + 1

    # Process leave balance for each day
    is_paid = False
    current_day = leave_date
    while current_day <= leave_end_date:
        year = current_day.year
        month = current_day.month

        # Check leave balance
        balance_resp = supabase.table("leave_balances").select("*").eq("employee_id", employee_id).eq("year", year).eq("month", month).execute()

        if not balance_resp.data:
            # Create balance record
            balance = {
                "employee_id": employee_id,
                "year": year,
                "month": month,
                "paid_leaves_quota": 1,
                "paid_leaves_used": 0
            }
            supabase.table("leave_balances").insert(balance).execute()
            paid_leaves_used = 0
            paid_leaves_quota = 1
        else:
            balance = balance_resp.data[0]
            paid_leaves_used = balance["paid_leaves_used"]
            paid_leaves_quota = balance["paid_leaves_quota"]

        if paid_leaves_used < paid_leaves_quota:
            is_paid = True
            supabase.table("leave_balances").update(
                {"paid_leaves_used": paid_leaves_used + 1}
            ).eq("employee_id", employee_id).eq("year", year).eq("month", month).execute()

        current_day += timedelta(days=1)

    # Update leave request
    updated_req = {
        "status": "APPROVED",
        "is_paid": is_paid,
        "reviewed_by": current_user["id"],
        "reviewed_at": "now()"
    }

    result = supabase.table("leave_requests").update(updated_req).eq("id", leave_id).execute()
    leave_record = result.data[0]

    # Notify employee via in-app notification
    try:
        notify_employee_leave_approved(
            employee_id=employee_id,
            leave_id=leave_id,
            leave_date=leave_date,
            leave_end_date=leave_end_date if leave_end_date != leave_date else None,
            approved_by_user_id=current_user["id"],
        )
    except Exception as exc:
        logger.error(f"Failed to notify employee of approval: {exc}")

    # Send push notification to employee
    try:
        from app.services.notification_service import _get_user_id_for_employee, _format_date_range_spoken
        user_id = _get_user_id_for_employee(employee_id)
        if user_id:
            date_str = _format_date_range_spoken(leave_date, leave_end_date)
            send_push_to_user(
                user_id=user_id,
                title="Leave approved",
                body=f"Your leave for {date_str} has been approved",
                data={"type": "LEAVE_APPROVED", "leave_id": leave_id},
            )
    except Exception as exc:
        logger.error(f"Failed to send push to employee: {exc}")

    return leave_record


@router.post("/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    req: LeaveRejectRequest,
    current_user: dict = Depends(require_role(["ADMIN", "SUPERADMIN"]))
):
    supabase = get_supabase()

    # Get leave request
    leave_req_resp = supabase.table("leave_requests").select("*").eq("id", leave_id).execute()
    if not leave_req_resp.data:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave_req = leave_req_resp.data[0]
    if leave_req["status"] != "PENDING":
        raise HTTPException(status_code=400, detail=f"Leave request is already {leave_req['status']}")

    employee_id = leave_req["employee_id"]
    leave_date = date.fromisoformat(leave_req["leave_date"])
    leave_end_date = date.fromisoformat(leave_req["leave_end_date"]) if leave_req.get("leave_end_date") else leave_date

    updated_req = {
        "status": "REJECTED",
        "rejection_reason": req.rejection_reason,
        "reviewed_by": current_user["id"],
        "reviewed_at": "now()"
    }

    result = supabase.table("leave_requests").update(updated_req).eq("id", leave_id).execute()
    leave_record = result.data[0]

    # Notify employee via in-app notification
    try:
        notify_employee_leave_rejected(
            employee_id=employee_id,
            leave_id=leave_id,
            leave_date=leave_date,
            leave_end_date=leave_end_date if leave_end_date != leave_date else None,
            rejected_by_user_id=current_user["id"],
            rejection_reason=req.rejection_reason,
        )
    except Exception as exc:
        logger.error(f"Failed to notify employee of rejection: {exc}")

    # Send push notification to employee
    try:
        from app.services.notification_service import _get_user_id_for_employee, _format_date_range_spoken
        user_id = _get_user_id_for_employee(employee_id)
        if user_id:
            date_str = _format_date_range_spoken(leave_date, leave_end_date)
            send_push_to_user(
                user_id=user_id,
                title="Leave rejected",
                body=f"Your leave for {date_str} has been rejected. Reason: {req.rejection_reason}",
                data={"type": "LEAVE_REJECTED", "leave_id": leave_id},
            )
    except Exception as exc:
        logger.error(f"Failed to send push to employee: {exc}")

    return leave_record


# --- REPORTS ---
@router.get("/summary/{employee_id}")
async def get_leave_summary(
    employee_id: str,
    year: int = Query(..., description="Year"),
    current_user: dict = Depends(require_role(["ADMIN", "SUPERADMIN"]))
):
    supabase = get_supabase()

    start_date = date(year, 1, 1).isoformat()
    end_date = date(year + 1, 1, 1).isoformat()

    response = supabase.table("leave_requests").select("*").eq("employee_id", employee_id).gte("leave_date", start_date).lt("leave_date", end_date).execute()

    summary = {
        "total_taken": 0,
        "paid": 0,
        "unpaid": 0,
        "pending": 0,
        "rejected": 0,
        "monthly": {}
    }

    for i in range(1, 13):
        summary["monthly"][i] = {"paid": 0, "unpaid": 0}

    for leave in response.data:
        leave_date = date.fromisoformat(leave["leave_date"])
        leave_end = date.fromisoformat(leave["leave_end_date"]) if leave.get("leave_end_date") else leave_date
        num_days = (leave_end - leave_date).days + 1
        month = leave_date.month

        if leave["status"] == "APPROVED":
            summary["total_taken"] += num_days
            if leave["is_paid"]:
                summary["paid"] += num_days
                summary["monthly"][month]["paid"] += num_days
            else:
                summary["unpaid"] += num_days
                summary["monthly"][month]["unpaid"] += num_days
        elif leave["status"] == "PENDING":
            summary["pending"] += num_days
        elif leave["status"] == "REJECTED":
            summary["rejected"] += num_days

    return summary
