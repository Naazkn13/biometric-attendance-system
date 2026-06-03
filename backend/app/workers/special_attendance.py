"""Special Attendance Worker for Shabnam and Asifa.

Runs every night. If yesterday was a Monday or Thursday, and not a holiday,
it injects an 8-hour completed session for Shabnam (9am to 5pm) and Asifa (9:30am to 5:30pm).
Then it recalculates their payroll.
"""

import logging
from datetime import date, datetime, timedelta, time
import calendar
import pytz

from app.database import get_supabase
from app.workers.payroll_worker import calculate_payroll

logger = logging.getLogger(__name__)

async def run_special_attendance(target_date: date = None):
    """
    Automated job for Shabnam and Asifa.
    Runs every night. If target_date is not provided, targets yesterday.
    Checks if target_date was Monday (0) or Thursday (3).
    If it wasn't a holiday, creates an 8-hour attendance session.
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)
        
    weekday = target_date.weekday()
    if weekday not in [0, 3]: # Monday=0, Thursday=3
        logger.info(f"Special Attendance: Skipping {target_date}, not a Monday or Thursday.")
        return
        
    db = get_supabase()
    target_date_str = target_date.isoformat()
    
    try:
        # Check if the target date is a holiday
        calendar_day = db.table("calendar_days").select("*").eq("date", target_date_str).execute()
        is_today_holiday = False
        if calendar_day.data:
            day_record = calendar_day.data[0]
            if day_record.get("is_holiday") or day_record.get("day_type") == "HOLIDAY":
                is_today_holiday = True
                
        if is_today_holiday:
            logger.info(f"Special Attendance: Skipping {target_date}, it was a holiday.")
            return
            
        # If today is Thursday, also check if the preceding Monday was a holiday
        if weekday == 3: # Thursday
            monday_date = target_date - timedelta(days=3)
            monday_str = monday_date.isoformat()
            monday_res = db.table("calendar_days").select("*").eq("date", monday_str).execute()
            if monday_res.data:
                mon_record = monday_res.data[0]
                if mon_record.get("is_holiday") or mon_record.get("day_type") == "HOLIDAY":
                    logger.info(f"Special Attendance: Skipping Thursday {target_date}, because preceding Monday ({monday_str}) was a holiday.")
                    return
            
        # Get Shabnam and Asifa
        employees_res = db.table("employees").select("*").execute()
        target_employees = []
        for emp in employees_res.data:
            name = emp.get("name", "").lower()
            if "shabnam" in name or "asifa" in name:
                target_employees.append(emp)
                
        if not target_employees:
            logger.warning("Special Attendance: Could not find Shabnam or Asifa.")
            return
            
        ist = pytz.timezone('Asia/Kolkata')
        
        for emp in target_employees:
            name_lower = emp.get("name", "").lower()
            if 'shabnam' in name_lower:
                check_in_dt = ist.localize(datetime.combine(target_date, time(9, 0)))
                check_out_dt = ist.localize(datetime.combine(target_date, time(17, 30)))
            elif 'asifa' in name_lower:
                check_in_dt = ist.localize(datetime.combine(target_date, time(9, 30)))
                check_out_dt = ist.localize(datetime.combine(target_date, time(17, 30)))
            else:
                continue
                
            emp_id = emp["id"]
            
            # Dynamically calculate hours
            delta = check_out_dt - check_in_dt
            hours = round(delta.total_seconds() / 3600.0, 2)
            
            # Check if session exists
            existing_res = db.table("attendance_sessions").select("*").eq("employee_id", emp_id).eq("session_date", target_date_str).execute()
            
            session_data = {
                "employee_id": emp_id,
                "session_date": target_date_str,
                "punch_in_time": check_in_dt.isoformat(),
                "punch_out_time": check_out_dt.isoformat(),
                "gross_hours": hours,
                "net_hours": hours,
                "status": "COMPLETE",
                "has_override": True,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if existing_res.data:
                # Update
                session_id = existing_res.data[0]["id"]
                db.table("attendance_sessions").update(session_data).eq("id", session_id).execute()
                logger.info(f"Special Attendance: Updated session for {emp['name']} on {target_date_str}")
            else:
                # Insert
                db.table("attendance_sessions").insert(session_data).execute()
                logger.info(f"Special Attendance: Created session for {emp['name']} on {target_date_str}")
                
            # Recalculate payroll
            period_start = target_date.replace(day=1)
            last_day = calendar.monthrange(target_date.year, target_date.month)[1]
            period_end = target_date.replace(day=last_day)
            
            await calculate_payroll(emp_id, period_start, period_end)
            logger.info(f"Special Attendance: Recalculated payroll for {emp['name']}")
            
    except Exception as e:
        logger.error(f"Special Attendance Error: {str(e)}", exc_info=True)
