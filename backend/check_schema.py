"""Check raw_punches table schema and constraints on V-Care Supabase."""
import os
from dotenv import load_dotenv
load_dotenv(".env")

from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
db = create_client(url, key)

# Check if we can query raw_punches
print("=== Checking raw_punches table ===")
try:
    res = db.table("raw_punches").select("*").limit(5).execute()
    print(f"Query OK. Found {len(res.data)} records.")
    if res.data:
        print(f"Sample record keys: {list(res.data[0].keys())}")
        for r in res.data:
            print(f"  ID={r.get('id')}, user={r.get('device_user_id')}, time={r.get('punch_time')}, sn={r.get('device_sn')}")
except Exception as e:
    print(f"Query FAILED: {e}")

# Try to do the exact same upsert the sync endpoint does
print("\n=== Testing upsert with on_conflict ===")
try:
    punch = {
        "device_user_id": "99",
        "punch_time": "2026-07-11T08:00:00+00:00",
        "device_sn": "NFZ8250200789",
        "raw_payload": {"test": "schema_check"},
        "is_processed": False,
    }
    res = db.table("raw_punches").upsert(
        [punch],
        on_conflict="device_sn,device_user_id,punch_time",
        ignore_duplicates=True,
    ).execute()
    print(f"Upsert OK: {res.data}")
except Exception as e:
    print(f"Upsert FAILED: {e}")

# Check RPC to list constraints
print("\n=== Checking table constraints via SQL ===")
try:
    res = db.rpc("", {}).execute()
except:
    pass

# Try a simple insert instead of upsert
print("\n=== Testing simple insert ===")
try:
    punch2 = {
        "device_user_id": "98",
        "punch_time": "2026-07-11T07:00:00+00:00",
        "device_sn": "NFZ8250200789",
        "raw_payload": {"test": "simple_insert"},
        "is_processed": False,
    }
    res = db.table("raw_punches").insert(punch2).execute()
    print(f"Simple insert OK: {res.data}")
except Exception as e:
    print(f"Simple insert FAILED: {e}")
