import time
import requests
import datetime
import logging
import os
from zk import ZK

# ======== CONFIGURATION ========
DEVICE_IP = "192.168.1.201"
DEVICE_PORT = 4370
DEVICE_SN = "4266542501559"
CLOUD_API_URL = "https://attendance-production-38c4.up.railway.app/api/sync/upload-dat"
POLL_INTERVAL_SECONDS = 60
# ===============================

# Log to file next to this script (no window = no console output)
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)

logger.info(f"Agent started — device {DEVICE_SN} at {DEVICE_IP}")
logger.info(f"Cloud API: {CLOUD_API_URL}")


def sync_data():
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=10)
    conn = None
    try:
        conn = zk.connect()
        conn.disable_device()

        attendances = conn.get_attendance()

        lines = []
        for att in attendances:
            dt_str = att.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            lines.append(f"{att.user_id}\t{dt_str}\t{att.status}\t{att.punch}")

        conn.enable_device()

        if lines:
            attlog_data = "\n".join(lines)
            logger.info(f"Found {len(lines)} records. Pushing to cloud...")

            files = {'file': ('sync.dat', attlog_data, 'text/plain')}
            data = {'device_sn': DEVICE_SN}

            resp = requests.post(CLOUD_API_URL, files=files, data=data)

            if resp.status_code == 200:
                result = resp.json()
                logger.info(f"Cloud Sync OK: {result['inserted']} new, {result['errors']} errors.")
            else:
                logger.error(f"Cloud API Error: {resp.status_code} - {resp.text}")
        else:
            logger.info("No records found on device.")

    except Exception as e:
        logger.error(f"Connection Error: {e}")
    finally:
        if conn:
            conn.disconnect()


if __name__ == "__main__":
    while True:
        sync_data()
        time.sleep(POLL_INTERVAL_SECONDS)
