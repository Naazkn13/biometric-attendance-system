"""Attendance API — V-Care Punch Viewer.

Provides punch-log views for the doctor:
  1. Date-wise: all employees' punches for a given date
  2. Employee-wise: one employee's punches for a month
  3. Employee + Date: detailed punches for one employee on one date
"""

from fastapi import APIRouter, Query, HTTPException
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from app.database import get_supabase
from app.utils.timezone import to_local

router = APIRouter(tags=["Attendance"])


def _get_ist_today() -> str:
    """Get today's date in IST (Asia/Kolkata), regardless of server timezone."""
    from app.utils.timezone import to_local
    import pytz
    now_utc = datetime.now(pytz.utc)
    now_ist = to_local(now_utc)
    return now_ist.date().isoformat()


def _correct_client_date(client_date: Optional[str]) -> str:
    """Correct the UTC-shifted date sent by the mobile app.

    The mobile app uses `new Date().toISOString().split('T')[0]` which gives
    the UTC date, not the local (IST) date. Between 00:00 and 05:30 IST,
    the UTC date is one day behind the IST date.

    During this window, toISOString() shifts ALL dates back by 1 day — not
    just today. When the user navigates to "July 11", the Date object is
    July 11 at ~3 AM IST, which toISOString() converts to July 10 ~9:30 PM
    UTC, extracting "2026-07-10". So ALL dates need +1 day correction.

    TODO: Remove this workaround once the mobile app is updated to use
    local date formatting (getFullYear/getMonth/getDate instead of toISOString).
    """
    import pytz
    from app.utils.timezone import to_local

    now_utc = datetime.now(pytz.utc)
    now_ist = to_local(now_utc)
    today_ist = now_ist.date().isoformat()
    today_utc = now_utc.date().isoformat()

    if not client_date:
        return today_ist

    # When UTC and IST dates differ (00:00–05:30 IST window),
    # the mobile app shifts ALL dates back by 1 day via toISOString().
    # Correct by adding 1 day to any date received during this window.
    if today_utc != today_ist:
        try:
            corrected = date.fromisoformat(client_date) + timedelta(days=1)
            return corrected.isoformat()
        except (ValueError, TypeError):
            return today_ist

    return client_date


def _format_local_time(utc_str: Optional[str], fmt: str = "%I:%M %p") -> Optional[str]:
    """Convert UTC ISO string to local time formatted string."""
    if not utc_str:
        return None
    try:
        utc_dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
        local_dt = to_local(utc_dt)
        return local_dt.strftime(fmt)
    except Exception:
        return utc_str


def _format_local_time_full(utc_str: Optional[str]) -> Optional[str]:
    """Convert UTC ISO string to local time with seconds."""
    return _format_local_time(utc_str, fmt="%I:%M:%S %p")


def _calc_duration(punch_in_str: Optional[str], punch_out_str: Optional[str]) -> str:
    """Calculate duration between two UTC ISO strings as 'Xh Ym' format."""
    if not punch_in_str or not punch_out_str:
        return "—"
    try:
        t_in = datetime.fromisoformat(punch_in_str.replace("Z", "+00:00"))
        t_out = datetime.fromisoformat(punch_out_str.replace("Z", "+00:00"))
        delta = t_out - t_in
        total_minutes = int(delta.total_seconds() / 60)
        hours = total_minutes // 60
        minutes = total_minutes % 60
        return f"{hours}h {minutes:02d}m"
    except Exception:
        return "—"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. DATE-WISE PUNCH LOG — All employees for a date
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/attendance/punch-log/by-date")
async def punch_log_by_date(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
):
    """Get all employees' punches for a given date."""
    db = get_supabase()

    target_date = _correct_client_date(date)

    # Get all active employees
    employees = db.table("employees") \
        .select("id, name, device_user_id") \
        .eq("is_active", True) \
        .order("name") \
        .execute()

    # Get all sessions for the target date
    sessions = db.table("attendance_sessions") \
        .select("*") \
        .eq("session_date", target_date) \
        .order("punch_in_time") \
        .execute()

    # Group sessions by employee
    sessions_by_emp = {}
    for s in (sessions.data or []):
        eid = s["employee_id"]
        if eid not in sessions_by_emp:
            sessions_by_emp[eid] = []
        sessions_by_emp[eid].append(s)

    present = 0
    absent = 0
    employee_list = []

    for emp in (employees.data or []):
        emp_sessions = sessions_by_emp.get(emp["id"], [])

        if emp_sessions:
            present += 1
            # Determine overall status
            statuses = [s["status"] for s in emp_sessions]
            if "OPEN" in statuses:
                overall_status = "OPEN"
            elif "AUTO_CHECKOUT" in statuses:
                overall_status = "AUTO_CHECKOUT"
            else:
                overall_status = "COMPLETE"

            punches = []
            for s in emp_sessions:
                punches.append({
                    "in": _format_local_time(s.get("punch_in_time")),
                    "out": _format_local_time(s.get("punch_out_time")),
                    "hours": float(s.get("net_hours", 0)),
                    "duration": _calc_duration(s.get("punch_in_time"), s.get("punch_out_time")),
                    "status": s["status"],
                })

            total_hours = round(sum(float(s.get("net_hours", 0)) for s in emp_sessions), 2)
        else:
            absent += 1
            overall_status = "ABSENT"
            punches = []
            total_hours = 0

        employee_list.append({
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "punches": punches,
            "total_hours": total_hours,
            "status": overall_status,
        })

    return {
        "date": target_date,
        "summary": {
            "total_employees": len(employees.data or []),
            "present": present,
            "absent": absent,
        },
        "employees": employee_list,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. EMPLOYEE-WISE PUNCH LOG — One employee, full month
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/attendance/punch-log/by-employee")
async def punch_log_by_employee(
    employee_id: UUID = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
):
    """Get one employee's punches for an entire month."""
    db = get_supabase()

    # Get employee info
    emp_result = db.table("employees") \
        .select("id, name") \
        .eq("id", str(employee_id)) \
        .execute()

    if not emp_result.data:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee = emp_result.data[0]

    # Calculate date range
    from calendar import monthrange
    _, last_day = monthrange(year, month)
    period_start = f"{year}-{month:02d}-01"
    period_end = f"{year}-{month:02d}-{last_day:02d}"

    # Get sessions
    sessions = db.table("attendance_sessions") \
        .select("*") \
        .eq("employee_id", str(employee_id)) \
        .gte("session_date", period_start) \
        .lte("session_date", period_end) \
        .order("session_date") \
        .order("punch_in_time") \
        .execute()

    # Group by date
    from datetime import date as date_type
    days = []
    days_present = 0
    days_absent = 0
    total_month_hours = 0.0

    current = date_type(year, month, 1)
    end_date = date_type(year, month, last_day)
    today = date_type.today()

    while current <= end_date and current <= today:
        d = current.isoformat()
        day_sessions = [s for s in (sessions.data or []) if s["session_date"] == d]

        if day_sessions:
            days_present += 1
            statuses = [s["status"] for s in day_sessions]
            if "OPEN" in statuses:
                day_status = "OPEN"
            elif "AUTO_CHECKOUT" in statuses:
                day_status = "AUTO_CHECKOUT"
            else:
                day_status = "COMPLETE"

            punches = []
            for s in day_sessions:
                punches.append({
                    "in": _format_local_time(s.get("punch_in_time")),
                    "out": _format_local_time(s.get("punch_out_time")),
                    "duration": _calc_duration(s.get("punch_in_time"), s.get("punch_out_time")),
                    "status": s["status"],
                })

            day_hours = round(sum(float(s.get("net_hours", 0)) for s in day_sessions), 2)
            total_month_hours += day_hours
        else:
            days_absent += 1
            day_status = "ABSENT"
            punches = []
            day_hours = 0

        days.append({
            "date": d,
            "day": current.strftime("%A"),
            "punches": punches,
            "total_hours": day_hours,
            "status": day_status,
        })

        current += timedelta(days=1)

    import calendar
    month_name = calendar.month_name[month]

    return {
        "employee_id": str(employee_id),
        "employee_name": employee["name"],
        "month": f"{month_name} {year}",
        "days": days,
        "summary": {
            "days_present": days_present,
            "days_absent": days_absent,
            "total_hours": round(total_month_hours, 2),
        },
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. EMPLOYEE + DATE — Detailed punches for one employee on one date
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/attendance/punch-log/by-employee-date")
async def punch_log_by_employee_date(
    employee_id: UUID = Query(...),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
):
    """Get detailed punches for one employee on a specific date."""
    db = get_supabase()

    # Get employee info
    emp_result = db.table("employees") \
        .select("id, name") \
        .eq("id", str(employee_id)) \
        .execute()

    if not emp_result.data:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee = emp_result.data[0]

    # Get sessions for this employee on this date
    sessions = db.table("attendance_sessions") \
        .select("*") \
        .eq("employee_id", str(employee_id)) \
        .eq("session_date", date) \
        .order("punch_in_time") \
        .execute()

    session_list = []
    total_minutes = 0

    for idx, s in enumerate(sessions.data or [], start=1):
        punch_in_local = _format_local_time_full(s.get("punch_in_time"))
        punch_out_local = _format_local_time_full(s.get("punch_out_time"))
        duration = _calc_duration(s.get("punch_in_time"), s.get("punch_out_time"))

        # Calculate minutes for day total
        if s.get("punch_in_time") and s.get("punch_out_time"):
            try:
                t_in = datetime.fromisoformat(s["punch_in_time"].replace("Z", "+00:00"))
                t_out = datetime.fromisoformat(s["punch_out_time"].replace("Z", "+00:00"))
                total_minutes += int((t_out - t_in).total_seconds() / 60)
            except Exception:
                pass

        session_list.append({
            "session_number": idx,
            "punch_in_local": punch_in_local,
            "punch_out_local": punch_out_local,
            "duration": duration,
            "status": s["status"],
            "hours": float(s.get("net_hours", 0)),
        })

    # Format day total
    if total_minutes > 0:
        day_total = f"{total_minutes // 60}h {total_minutes % 60:02d}m"
    else:
        day_total = "0h 00m"

    return {
        "employee_id": str(employee_id),
        "employee_name": employee["name"],
        "date": date,
        "sessions": session_list,
        "day_total": day_total,
        "total_hours": round(total_minutes / 60, 2) if total_minutes > 0 else 0,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TRIGGER ENDPOINTS (for manual testing)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/attendance/trigger-session-builder")
async def trigger_session_builder():
    """Manually trigger the session builder worker."""
    from app.workers.session_builder import run_session_builder
    result = await run_session_builder()
    return {"message": "Session builder ran", "result": result}


@router.post("/attendance/trigger-auto-checkout")
async def trigger_auto_checkout():
    """Manually trigger the auto checkout worker."""
    from app.workers.auto_checkout import run_auto_checkout
    result = await run_auto_checkout()
    return {"message": "Auto checkout ran", "result": result}
