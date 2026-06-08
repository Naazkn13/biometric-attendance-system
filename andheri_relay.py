"""
Andheri ADMS Relay + Active Poller
===================================
HYBRID approach for the Andheri ZKTeco device:

1. ACTIVE POLLER (primary): Every 60 seconds, connects to the device
   over LAN via ZK protocol, pulls new attendance records, and pushes
   them to the Railway backend via HTTP API.

2. ADMS PROXY (fallback): Also listens on port 8080 so if the device
   is ever configured for ADMS push mode, it will forward those
   requests to Railway too.

3. HEARTBEAT: Pings Railway every 60s to keep the device's online
   status fresh on the dashboard.

Requirements:
    pip install pyzk requests

Usage:
    python andheri_relay.py              (uses auto-detected device IP)
    python andheri_relay.py 192.168.1.50 (specify device IP manually)

Must be on the same WiFi/LAN as the Andheri ZKTeco device.
"""

import logging
import os
import sys
import time
import json
import socket
import threading
import requests
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# ======== CONFIGURATION ========
DEVICE_SN   = "170371318"          # Andheri device serial number
DEVICE_PORT = 4370                 # ZKTeco default ZK protocol port
RELAY_PORT  = 8080                 # HTTP proxy port for ADMS push fallback
RAILWAY_URL = "https://attendance-production-38c4.up.railway.app"
POLL_INTERVAL_SECONDS = 60         # How often to pull from device
# ================================

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "andheri_relay.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger(__name__)

# Track last seen punch to avoid re-sending old data
LAST_PUNCH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "andheri_last_punch.json")


def load_last_punch_time():
    """Load the timestamp of the last successfully sent punch."""
    try:
        if os.path.exists(LAST_PUNCH_FILE):
            with open(LAST_PUNCH_FILE, "r") as f:
                data = json.load(f)
                return datetime.fromisoformat(data["last_punch_time"])
    except Exception:
        pass
    return None


def save_last_punch_time(dt):
    """Save the timestamp of the last successfully sent punch."""
    try:
        with open(LAST_PUNCH_FILE, "w") as f:
            json.dump({"last_punch_time": dt.isoformat()}, f)
    except Exception as e:
        logger.error("Failed to save last punch time: {}".format(e))


def discover_device_ip():
    """Try to find the ZKTeco device on common LAN subnets."""
    logger.info("Attempting to auto-discover device on LAN...")

    # Get local IP to determine subnet
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "192.168.1.1"

    subnet = ".".join(local_ip.split(".")[:3])
    logger.info("Local IP: {}, scanning subnet: {}.x".format(local_ip, subnet))

    # Scan common IPs for ZK device on port 4370
    for i in range(1, 255):
        ip = "{}.{}".format(subnet, i)
        if ip == local_ip:
            continue
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.3)
            result = sock.connect_ex((ip, DEVICE_PORT))
            sock.close()
            if result == 0:
                logger.info("Found device at {}:{}!".format(ip, DEVICE_PORT))
                return ip
        except Exception:
            pass

    logger.warning("Auto-discovery failed. Please provide device IP as argument.")
    return None


def send_heartbeat():
    """Send a heartbeat to Railway to keep the device shown as online."""
    try:
        url = "{}/iclock/getrequest?SN={}".format(RAILWAY_URL, DEVICE_SN)
        resp = requests.get(url, timeout=10)
        logger.debug("Heartbeat sent, Railway replied: {}".format(resp.status_code))
    except Exception as e:
        logger.warning("Heartbeat failed: {}".format(e))


def send_punches_to_railway(punches):
    """Format attendance records as ATTLOG and POST to Railway."""
    if not punches:
        return 0

    # Build ATTLOG body: user_id\ttimestamp\tstatus\tverify
    lines = []
    for punch in punches:
        user_id = str(punch.user_id)
        # pyzk returns naive datetime in device local time (IST)
        timestamp = punch.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        status = str(getattr(punch, "status", 0))
        verify = str(getattr(punch, "punch", 0))
        lines.append("{}\t{}\t{}\t{}".format(user_id, timestamp, status, verify))

    body = "\n".join(lines)

    url = "{}/iclock/cdata?SN={}&table=ATTLOG&Stamp=0".format(RAILWAY_URL, DEVICE_SN)

    try:
        resp = requests.post(
            url,
            data=body.encode("utf-8"),
            headers={"Content-Type": "text/plain"},
            timeout=60,
        )
        if resp.status_code == 200:
            logger.info("Pushed {} punches to Railway. Response: {}".format(
                len(lines), resp.text.strip()))
            return len(lines)
        else:
            logger.error("Railway returned status {}: {}".format(
                resp.status_code, resp.text[:200]))
            return 0
    except Exception as e:
        logger.error("Failed to push punches to Railway: {}".format(e))
        return 0


def poll_device(device_ip):
    """Connect to device via ZK protocol, pull attendance, push to Railway."""
    try:
        from zk import ZK
    except ImportError:
        logger.error("pyzk not installed! Run: pip install pyzk")
        return

    logger.info("Connecting to device at {}:{}...".format(device_ip, DEVICE_PORT))

    zk = ZK(device_ip, port=DEVICE_PORT, timeout=10, password=0,
            force_udp=False, ommit_ping=False)
    conn = None
    try:
        conn = zk.connect()
        logger.info("Connected to device! Firmware: {}".format(
            conn.get_firmware_version()))

        # Lock the device so it allows data transfer (required for some older models)
        try:
            conn.disable_device()
        except Exception as e:
            logger.debug("Could not disable device (might not be supported): {}".format(e))

        try:
            # Pull all attendance records
            attendance = conn.get_attendance()
        finally:
            # Always unlock the device afterwards
            try:
                conn.enable_device()
            except Exception:
                pass

        if not attendance:
            logger.info("No attendance records on device.")
            send_heartbeat()
            return

        logger.info("Device has {} total attendance records.".format(len(attendance)))

        # Filter to only new punches since last sync
        last_punch = load_last_punch_time()
        if last_punch:
            new_punches = [p for p in attendance if p.timestamp > last_punch]
        else:
            # First run — send all punches (Railway will deduplicate via UPSERT)
            new_punches = attendance

        if new_punches:
            logger.info("{} new punches to send.".format(len(new_punches)))
            sent = send_punches_to_railway(new_punches)
            if sent > 0:
                # Save the latest punch timestamp
                latest = max(p.timestamp for p in new_punches)
                save_last_punch_time(latest)
                logger.info("Synced {} punches. Latest: {}".format(sent, latest))
        else:
            logger.info("No new punches since last sync.")

        # Always send heartbeat
        send_heartbeat()

    except Exception as e:
        logger.error("Device poll error: {}".format(e))
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass


def poller_thread(device_ip):
    """Background thread that polls the device every POLL_INTERVAL_SECONDS."""
    logger.info("Poller thread started. Polling every {}s.".format(POLL_INTERVAL_SECONDS))

    while True:
        try:
            poll_device(device_ip)
        except Exception as e:
            logger.error("Poller thread error: {}".format(e))

        time.sleep(POLL_INTERVAL_SECONDS)


# ─── ADMS Proxy (fallback) ────────────────────────────────────────

class ProxyHandler(BaseHTTPRequestHandler):
    """Transparent HTTP proxy for ADMS push mode (fallback)."""

    def log_message(self, format, *args):
        pass  # use our own logger

    def _proxy(self, method):
        path = self.path
        url = "{}{}".format(RAILWAY_URL, path)

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None

        logger.info("ADMS PUSH {} {} body_len={}".format(method, path, length))

        try:
            resp = requests.request(
                method=method,
                url=url,
                data=body,
                headers={"Content-Type": self.headers.get("Content-Type", "text/plain")},
                timeout=60,
            )
            logger.info("Railway replied {} - {}".format(resp.status_code, repr(resp.text[:120])))
            self._respond(resp.status_code, resp.text)

        except Exception as e:
            logger.error("Proxy error: {}".format(e))
            self._respond(200, "OK\r\n")

    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        self._proxy("POST")

    def _respond(self, code, text):
        encoded = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    # Get device IP from argument or auto-discover
    if len(sys.argv) > 1:
        device_ip = sys.argv[1]
        logger.info("Using provided device IP: {}".format(device_ip))
    else:
        device_ip = discover_device_ip()
        if not device_ip:
            logger.error(
                "Could not find device. Please provide IP as argument:\n"
                "  python andheri_relay.py 192.168.1.50\n\n"
                "To find your device IP:\n"
                "  1. On the ZKTeco device, go to Menu > COMM > Ethernet\n"
                "  2. Note the IP address shown\n"
            )
            sys.exit(1)

    logger.info("=" * 60)
    logger.info("Andheri Relay + Poller STARTING")
    logger.info("Device IP   : {}:{}".format(device_ip, DEVICE_PORT))
    logger.info("Device SN   : {}".format(DEVICE_SN))
    logger.info("Railway URL : {}".format(RAILWAY_URL))
    logger.info("Poll interval: {}s".format(POLL_INTERVAL_SECONDS))
    logger.info("ADMS proxy  : port {}".format(RELAY_PORT))
    logger.info("=" * 60)

    # Start the active poller in a background thread
    poller = threading.Thread(target=poller_thread, args=(device_ip,), daemon=True)
    poller.start()

    # Start the ADMS proxy in the main thread (fallback for push mode)
    try:
        logger.info("ADMS proxy listening on port {}...".format(RELAY_PORT))
        server = HTTPServer(("0.0.0.0", RELAY_PORT), ProxyHandler)
        server.serve_forever()
    except PermissionError:
        logger.error("Port {} requires admin. Run as Administrator.".format(RELAY_PORT))
    except OSError as e:
        logger.error("Could not start proxy server: {}".format(e))
        logger.info("Continuing with poller only (no ADMS proxy)...")
        # Keep running with just the poller
        while True:
            time.sleep(60)
