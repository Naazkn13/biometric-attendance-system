"""Test: simulate exact relay upload to Railway backend"""
import requests

CLOUD_API_URL = "https://biometric-attendance-system-production.up.railway.app/api/sync/upload-dat"
DEVICE_SN = "NFZ8250200789"

# Simulate the exact format the relay sends
lines = ["1\t2026-07-11 10:00:00\t0\t1"]
attlog_data = "\n".join(lines)

files = {'file': ('sync.dat', attlog_data, 'text/plain')}
data = {'device_sn': DEVICE_SN}

resp = requests.post(CLOUD_API_URL, files=files, data=data, timeout=60)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")

# Now test locally with more verbose error output
print("\n--- Local test with verbose errors ---")
from dotenv import load_dotenv
load_dotenv(".env")

from app.utils.timezone import parse_device_datetime
try:
    result = parse_device_datetime("2026-07-11 10:00:00")
    print(f"parse_device_datetime OK: {result}")
except Exception as e:
    print(f"parse_device_datetime FAILED: {e}")
