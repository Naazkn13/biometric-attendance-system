import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv("backend/.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Get all REOPENED sessions with 0h
res = supabase.table("attendance_sessions").select("*").eq("status", "REOPENED").execute()

deleted = 0
for session in res.data:
    if session.get("net_hours", 0) == 0:
        # Check if there is another session for the same day and employee
        other_res = supabase.table("attendance_sessions").select("id").eq("employee_id", session["employee_id"]).eq("session_date", session["session_date"]).neq("id", session["id"]).execute()
        if other_res.data:
            print(f"Deleting duplicate REOPENED session {session['id']} for {session['session_date']}")
            supabase.table("attendance_sessions").delete().eq("id", session["id"]).execute()
            deleted += 1

print(f"Deleted {deleted} duplicate REOPENED sessions.")
