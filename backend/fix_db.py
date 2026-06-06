import asyncio
from datetime import date
from app.database import get_supabase
from app.workers.payroll_worker import calculate_payroll
from app.config import get_settings

async def fix():
    settings = get_settings()
    from supabase import create_client
    db = create_client(settings.supabase_url, settings.supabase_key)
    
    # 28th of May 2026
    target_date = "2026-05-28"
    
    # Get Shabnam and Asifa
    employees = db.table("employees").select("*").execute()
    target_ids = []
    for emp in employees.data:
        name = emp.get("name", "").lower()
        if "shabnam" in name or "asifa" in name:
            target_ids.append(emp["id"])
            print(f"Found employee: {name} ({emp['id']})")
    
    for emp_id in target_ids:
        # Delete session
        res = db.table("attendance_sessions").delete().eq("employee_id", emp_id).eq("session_date", target_date).execute()
        print(f"Deleted sessions for {emp_id} on {target_date}: {len(res.data) if res.data else 0}")
        
        # Recalculate payroll for May
        await calculate_payroll(emp_id, date(2026, 5, 1), date(2026, 5, 31))
        print(f"Recalculated payroll for {emp_id}")

asyncio.run(fix())
