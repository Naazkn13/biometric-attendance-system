"""Clean up test data from V-Care Supabase."""
import os
from dotenv import load_dotenv
load_dotenv(".env")

from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
db = create_client(url, key)

print("🗑️  Skipping raw_punches deletion via API due to database trigger (requires SQL Editor).")

# 2. Delete broken attendance sessions (ones with null punch times)
print("🗑️  Deleting broken attendance sessions...")
try:
    res = db.table("attendance_sessions").delete().is_("punch_in_time", "null").is_("punch_out_time", "null").execute()
    print(f"   Deleted {len(res.data)} broken sessions")
except Exception as e:
    print(f"   Error: {e}")

# 3. Reset device status from 'error' to 'ok'
print("🔄 Resetting device status...")
try:
    res = db.table("devices").update({"poll_status": "ok"}).eq("device_sn", "NFZ8250200789").execute()
    print(f"   Updated {len(res.data)} device(s)")
except Exception as e:
    print(f"   Error: {e}")

# 4. Verify clean state
print("\n✅ Verifying clean state:")
res = db.table("raw_punches").select("*", count="exact").execute()
print(f"   raw_punches remaining: {res.count if res.count is not None else len(res.data)}")

res = db.table("attendance_sessions").select("*", count="exact").execute()
print(f"   attendance_sessions remaining: {res.count if res.count is not None else len(res.data)}")

res = db.table("devices").select("device_sn,poll_status").execute()
for d in res.data:
    print(f"   Device {d['device_sn']}: status={d['poll_status']}")

print("\n🧹 API Cleanup complete! Ready for fresh relay sync.")
