"""
Andheri ADMS Relay
==================
Transparent HTTP proxy. ZKTeco device pushes to THIS PC (LAN).
This relay forwards every request to Railway and returns the response.

Device → Relay (port 8080) → Railway → response back to device

Usage:
    python andheri_relay.py   (must be run as Administrator)
"""

import logging
import os
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# ======== CONFIGURATION ========
RELAY_PORT  = 8080
RAILWAY_URL = "https://attendance-production-38c4.up.railway.app"
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


class ProxyHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # use our own logger

    def _proxy(self, method):
        path = self.path  # e.g. /iclock/cdata?SN=xxx&table=ATTLOG
        url  = "{}{}".format(RAILWAY_URL, path)

        # Read request body for POST
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length) if length else None

        logger.info("{} {} body_len={}".format(method, path, length))

        try:
            resp = requests.request(
                method  = method,
                url     = url,
                data    = body,
                headers = {"Content-Type": self.headers.get("Content-Type", "text/plain")},
                timeout = 60,
            )
            logger.info("Railway replied {} — {}".format(resp.status_code, repr(resp.text[:120])))
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
    logger.info("Andheri ADMS Relay (proxy mode) starting on port {}".format(RELAY_PORT))
    logger.info("Forwarding all requests to: {}".format(RAILWAY_URL))

    try:
        server = HTTPServer(("0.0.0.0", RELAY_PORT), ProxyHandler)
        server.serve_forever()
    except PermissionError:
        logger.error("Port 8080 requires admin. Run as Administrator.")
    except OSError as e:
        logger.error("Could not start: {}".format(e))
