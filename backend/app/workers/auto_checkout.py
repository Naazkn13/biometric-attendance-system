"""Auto Checkout Worker — V-Care time-based session close.

Closes OPEN sessions based on punch-in time:
  - Punched in BEFORE 4:00 PM  → auto-close at 4:00 PM IST
  - Punched in AT/AFTER 4:00 PM → auto-close at 11:59 PM IST

Runs every 15 minutes via APScheduler.
"""

import logging
from datetime import datetime, time, timedelta

from app.database import get_supabase
from app.utils.timezone import to_local, get_business_tz

logger = logging.getLogger(__name__)

# Auto-close cutoff times (IST)
AFTERNOON_CUTOFF = time(16, 0, 0)   # 4:00 PM — morning/afternoon sessions close here
NIGHT_CUTOFF = time(23, 59, 0)      # 11:59 PM — night sessions close here


async def run_auto_checkout():
    """Main entry point: check all OPEN sessions and auto-close as needed."""
    db = get_supabase()

    # Get all OPEN sessions
    result = db.table("attendance_sessions") \
        .select("*") \
        .eq("status", "OPEN") \
        .execute()

    if not result.data:
        return {"auto_closed": 0}

    now_utc = datetime.utcnow()
    tz = get_business_tz()
    now_local = now_utc.replace(tzinfo=__import__('pytz').utc).astimezone(tz)
    auto_closed = 0

    for session in result.data:
        try:
            closed = await _check_and_close(db, session, now_local, tz)
            if closed:
                auto_closed += 1
        except Exception as e:
            logger.error(f"Error auto-checking session {session['id']}: {e}")

    if auto_closed > 0:
        logger.info(f"Auto Checkout: closed {auto_closed} sessions")

    return {"auto_closed": auto_closed}


async def _check_and_close(db, session: dict, now_local, tz) -> bool:
    """Check if a session should be auto-closed. Returns True if closed."""
    import pytz

    punch_in_str = session["punch_in_time"]
    if isinstance(punch_in_str, str):
        punch_in_utc = datetime.fromisoformat(punch_in_str.replace("Z", "+00:00"))
    else:
        punch_in_utc = punch_in_str

    # Ensure timezone-aware
    if punch_in_utc.tzinfo is None:
        punch_in_utc = pytz.utc.localize(punch_in_utc)

    # Convert punch-in to local time to decide which cutoff to use
    punch_in_local = punch_in_utc.astimezone(tz)

    # Get session date
    session_date_str = session["session_date"]
    if isinstance(session_date_str, str):
        from datetime import date as date_type
        session_date = date_type.fromisoformat(session_date_str)
    else:
        session_date = session_date_str

    # Determine deadline based on punch-in time
    if punch_in_local.time() < AFTERNOON_CUTOFF:
        # Morning/afternoon session → close at 4:00 PM
        deadline_local = tz.localize(datetime.combine(session_date, AFTERNOON_CUTOFF))
    else:
        # Night session → close at 11:59 PM
        deadline_local = tz.localize(datetime.combine(session_date, NIGHT_CUTOFF))

    # Check if past deadline
    if now_local < deadline_local:
        return False  # Not yet time to close

    # Calculate hours worked (punch_in to deadline)
    deadline_utc = deadline_local.astimezone(pytz.utc)
    delta = deadline_utc - punch_in_utc
    gross_hours = round(delta.total_seconds() / 3600, 2)
    net_hours = gross_hours  # No break deduction

    update_data = {
        "punch_out_time": deadline_utc.isoformat(),
        "auto_checkout_at": now_local.astimezone(pytz.utc).isoformat(),
        "gross_hours": gross_hours,
        "net_hours": net_hours,
        "status": "AUTO_CHECKOUT",
    }

    db.table("attendance_sessions").update(update_data).eq("id", session["id"]).execute()

    cutoff_name = "4:00 PM" if punch_in_local.time() < AFTERNOON_CUTOFF else "11:59 PM"
    logger.info(
        f"Auto Checkout: session {session['id']} closed at {cutoff_name}, "
        f"hours={net_hours}"
    )
    return True
