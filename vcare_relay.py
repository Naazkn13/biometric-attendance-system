"""
V-Care Hospital — Local Agent (PyZK Pull → Cloud Sync)
=======================================================
Uses the same proven method as the Yarroad local agent.

Connects to the ZKTeco biometric device on the hospital LAN,
pulls attendance records every 60 seconds, and pushes them to
the Railway backend via the /api/sync/upload-dat endpoint.

Device Details:
    Device Name : x 2008
    Serial No.  : NFZ8250200789
    Platform    : ZLM60_TFT
    Firmware    : Ver 8.0.4.3-20230515
    Employees   : 9 registered
    Fingerprints: 18 enrolled

Requirements:
    pip install pyzk requests

Usage:
    python vcare_relay.py                    (uses configured IP)
    python vcare_relay.py 192.168.x.x       (override device IP)

Must be on the same WiFi/LAN as the V-Care ZKTeco device.
"""

import time
import sys
import requests
import logging
import os
from datetime import datetime
from zk import ZK

# ════════════════════════════════════════
# CONFIGURATION — V-CARE HOSPITAL
# ════════════════════════════════════════
DEVICE_IP = "192.168.0.201"            # V-Care device IP (confirmed on hospital WiFi)
DEVICE_PORT = 4370                      # ZKTeco default ZK protocol port
DEVICE_SN = "NFZ8250200789"            # V-Care device serial number
CLOUD_API_URL = "https://biometric-attendance-system-production.up.railway.app/api/sync/upload-dat"
POLL_INTERVAL_SECONDS = 60              # Poll every 60 seconds
# ════════════════════════════════════════

# Log to file next to this script
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vcare_agent.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger(__name__)


def sync_data(device_ip):
    """Connect to device, pull attendance, push to cloud."""
    zk = ZK(device_ip, port=DEVICE_PORT, timeout=10)
    conn = None
    try:
        conn = zk.connect()

        # Disable device briefly to ensure clean data transfer
        try:
            conn.disable_device()
        except Exception:
            pass  # Some models don't support this

        attendances = conn.get_attendance()

        # Re-enable device immediately
        try:
            conn.enable_device()
        except Exception:
            pass

        if not attendances:
            logger.info("No records found on device.")
            return

        # Build ATTLOG lines
        lines = []
        for att in attendances:
            dt_str = att.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            lines.append(f"{att.user_id}\t{dt_str}\t{att.status}\t{att.punch}")

        if lines:
            attlog_data = "\n".join(lines)
            logger.info(f"Found {len(lines)} records. Pushing to cloud...")

            files = {'file': ('sync.dat', attlog_data, 'text/plain')}
            data = {'device_sn': DEVICE_SN}

            resp = requests.post(CLOUD_API_URL, files=files, data=data, timeout=60)

            if resp.status_code == 200:
                result = resp.json()
                logger.info(
                    f"Cloud Sync OK: {result['inserted']} new, "
                    f"{result['errors']} errors."
                )
            else:
                logger.error(f"Cloud API Error: {resp.status_code} - {resp.text}")

    except Exception as e:
        logger.error(f"Connection Error: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


if __name__ == "__main__":
    # Allow overriding device IP from command line
    device_ip = sys.argv[1] if len(sys.argv) > 1 else DEVICE_IP

    logger.info("=" * 55)
    logger.info("V-Care Hospital Agent STARTING")
    logger.info(f"  Device IP   : {device_ip}:{DEVICE_PORT}")
    logger.info(f"  Device SN   : {DEVICE_SN}")
    logger.info(f"  Cloud API   : {CLOUD_API_URL}")
    logger.info(f"  Poll every  : {POLL_INTERVAL_SECONDS}s")
    logger.info("=" * 55)

    while True:
        sync_data(device_ip)
        time.sleep(POLL_INTERVAL_SECONDS)
