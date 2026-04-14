"""
Andheri ADMS Relay
==================
Runs a tiny HTTP server on port 80.
The ZKTeco device pushes to THIS PC's local IP.
This script forwards all punches to Railway.

Usage:
    python andheri_relay.py
"""

import logging
import os
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

# ======== CONFIGURATION ========
RELAY_PORT = 80
RAILWAY_URL = "https://attendance-production-38c4.up.railway.app"
DEVICE_SN   = "170371318"   # Andheri device SN (auto-registered)
# ===============================

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "andheri_relay.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),   # also print to console during testing
    ]
)
logger = logging.getLogger(__name__)


def forward_punches_to_railway(body_text: str, sn: str):
    """Send ATTLOG data to Railway via the sync/upload-dat endpoint."""
    try:
        files = {"file": ("sync.dat", body_text, "text/plain")}
        data  = {"device_sn": sn}
        resp  = requests.post(
            f"{RAILWAY_URL}/api/sync/upload-dat",
            files=files,
            data=data,
            timeout=15,
        )
        if resp.status_code == 200:
            result = resp.json()
            logger.info(f"Forwarded to Railway — {result['inserted']} new, {result['errors']} errors")
        else:
            logger.error(f"Railway error {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to forward to Railway: {e}")


class ADMSHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress default HTTP logs (we use our own)

    def _sn(self):
        qs = parse_qs(urlparse(self.path).query)
        return qs.get("SN", [DEVICE_SN])[0]

    # ── GET /iclock/cdata  (handshake / heartbeat) ─────────────────
    def do_GET(self):
        sn = self._sn()
        path = urlparse(self.path).path

        if path == "/iclock/cdata":
            logger.info(f"Heartbeat from device SN={sn}")
            # Tell device to push its attendance log
            response = (
                "GET ATTLOG From=2000-01-01 00:00:00\r\n"
                "GET OPERLOG From=2000-01-01 00:00:00\r\n"
                "OK\r\n"
            )
            self._respond(200, response)

        elif path == "/iclock/getrequest":
            self._respond(200, "OK\r\n")

        else:
            self._respond(200, "OK\r\n")

    # ── POST /iclock/cdata  (attendance data) ──────────────────────
    def do_POST(self):
        sn    = self._sn()
        path  = urlparse(self.path).path
        qs    = parse_qs(urlparse(self.path).query)
        table = qs.get("table", [""])[0].upper()

        length   = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length) if length else b""
        body     = raw_body.decode("utf-8", errors="replace").strip()

        if path == "/iclock/cdata" and table == "ATTLOG" and body:
            lines = [l for l in body.split("\n") if l.strip()]
            logger.info(f"Received {len(lines)} punch lines from SN={sn}")
            forward_punches_to_railway(body, sn)

        self._respond(200, "OK\r\n")

    def _respond(self, code: int, text: str):
        encoded = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    logger.info(f"Andheri ADMS Relay starting on port {RELAY_PORT}")
    logger.info(f"Forwarding to Railway: {RAILWAY_URL}")
    logger.info(f"Waiting for device SN={DEVICE_SN}...")

    try:
        server = HTTPServer(("0.0.0.0", RELAY_PORT), ADMSHandler)
        server.serve_forever()
    except PermissionError:
        logger.error("Port 80 requires admin. Run as Administrator, or change RELAY_PORT to 8080.")
    except OSError as e:
        logger.error(f"Could not start server: {e}")
