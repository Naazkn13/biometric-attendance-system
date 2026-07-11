import os
import sys
from dotenv import load_dotenv

# Try to load V-Care specific env or default
load_dotenv(".env")


from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing Supabase credentials!")
    sys.exit(1)

supabase: Client = create_client(url, key)

try:
    # 1. Check if device exists
    device_sn = "NFZ8250200789"
    res = supabase.table("devices").select("*").eq("device_sn", device_sn).execute()
    print("Device Query Result:", res.data)
    
    if not res.data:
        print(f"Device {device_sn} not found! This is likely why the insert is failing.")
        
    # 2. Try to insert a dummy punch
    dummy_punch = {
        "device_user_id": "1",
        "punch_time": "2026-07-10T10:00:00Z",
        "device_sn": device_sn,
        "raw_payload": {"test": "test"},
        "is_processed": False
    }
    print("Trying to insert dummy punch...")
    res = supabase.table("raw_punches").upsert(
        [dummy_punch],
        on_conflict="device_sn,device_user_id,punch_time",
        ignore_duplicates=True,
    ).execute()
    print("Insert success:", res.data)

    
except Exception as e:
    print("Exception occurred:", str(e))
