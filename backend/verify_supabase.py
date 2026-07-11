"""Verify Supabase V-Care data state — check raw_punches and employees."""
import os
from dotenv import load_dotenv
load_dotenv(".env")

from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
db = create_client(url, key)

print("=" * 60)
print("V-CARE SUPABASE VERIFICATION")
print(f"URL: {url}")
print("=" * 60)

# 1. Check raw_punches count and date range
print("\n📊 RAW_PUNCHES TABLE:")
try:
    res = db.table("raw_punches").select("*", count="exact").execute()
    total = res.count if res.count is not None else len(res.data)
    print(f"  Total records: {total}")
    
    if res.data:
        # Get date range
        all_times = [r.get("punch_time", "") for r in res.data]
        all_times.sort()
        print(f"  Earliest punch: {all_times[0]}")
        print(f"  Latest punch:   {all_times[-1]}")
        
        # Show unique device_user_ids
        unique_users = set(r.get("device_user_id") for r in res.data)
        print(f"  Unique users:   {len(unique_users)}")
        print(f"  User IDs:       {sorted(unique_users)}")
        
        # Show unique device_sn
        unique_sn = set(r.get("device_sn") for r in res.data)
        print(f"  Device SNs:     {unique_sn}")
        
        # Show sample
        print(f"\n  Last 5 records:")
        for r in res.data[-5:]:
            print(f"    User={r.get('device_user_id')}, Time={r.get('punch_time')}, SN={r.get('device_sn')}, Processed={r.get('is_processed')}")
    else:
        print("  ⚠️ NO RECORDS FOUND!")
except Exception as e:
    print(f"  ❌ ERROR: {e}")

# 2. Check employees table
print("\n👥 EMPLOYEES TABLE:")
try:
    res = db.table("employees").select("*").execute()
    print(f"  Total employees: {len(res.data)}")
    for emp in res.data:
        print(f"    ID={emp.get('id')}, DeviceUID={emp.get('device_user_id')}, Name={emp.get('name')}")
except Exception as e:
    print(f"  ❌ ERROR: {e}")

# 3. Check devices table
print("\n🖥️ DEVICES TABLE:")
try:
    res = db.table("devices").select("*").execute()
    print(f"  Total devices: {len(res.data)}")
    for dev in res.data:
        print(f"    SN={dev.get('device_sn')}, Name={dev.get('name')}, LastSeen={dev.get('last_seen_at')}, Status={dev.get('poll_status')}")
except Exception as e:
    print(f"  ❌ ERROR: {e}")

# 4. Check attendance_sessions
print("\n📋 ATTENDANCE_SESSIONS TABLE:")
try:
    res = db.table("attendance_sessions").select("*", count="exact").limit(5).execute()
    total = res.count if res.count is not None else len(res.data)
    print(f"  Total sessions: {total}")
    if res.data:
        for s in res.data[:5]:
            print(f"    EmpID={s.get('employee_id')}, Date={s.get('date')}, In={s.get('first_in')}, Out={s.get('last_out')}")
except Exception as e:
    print(f"  ❌ ERROR: {e}")

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)
