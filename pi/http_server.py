"""
ShowUp HTTP sync server — iOS fallback for devices without Web Bluetooth.

Endpoints:
  GET  /            Captive-portal sync page (paste payload here)
  POST /sync        JSON payload body → render display (for programmatic callers)
  GET  /status      Returns "ok" (health check)

The server also redirects Apple/Android connectivity-check hosts back to /
so iOS shows the captive-portal banner automatically when the user connects
to the Pi's WiFi AP.

Run via main.py — do not execute directly.
"""

import hmac
import json
import logging
import os
import threading
from pathlib import Path
from typing import Callable

from flask import Flask, Response, redirect, render_template_string, request
from flask_cors import CORS

log = logging.getLogger(__name__)

# Static IP of the Pi when acting as a WiFi AP (set by ap_setup.sh)
PI_AP_IP = "10.42.0.1"
PORT = 8080
MAX_PAYLOAD_BYTES = 16 * 1024  # Hard cap — e-ink payloads are <1KB in practice
SYNC_TOKEN_PATH = Path("/etc/clipcal/sync_token")

# Hosts that trigger iOS / Android captive-portal detection
_CAPTIVE_HOSTS = {
    "captive.apple.com",
    "www.apple.com",
    "apple.com",
    "connectivitycheck.gstatic.com",
    "clients3.google.com",
    "connectivitycheck.android.com",
}


def _load_sync_token() -> str | None:
    env = os.environ.get("CLIPCAL_SYNC_TOKEN")
    if env:
        return env.strip()
    try:
        if SYNC_TOKEN_PATH.exists():
            token = SYNC_TOKEN_PATH.read_text(encoding="utf-8").strip()
            return token or None
    except OSError as exc:
        log.warning("sync token read failed: %s", exc)
    return None


_SYNC_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ShowUp Display Sync</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, sans-serif;
      background: #0a0a0a; color: #f0f0f0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; gap: 20px;
    }
    h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    p.sub { font-size: 13px; color: #888; text-align: center; max-width: 300px; }
    textarea {
      width: 100%; max-width: 360px; height: 130px;
      background: #1a1a1a; color: #f0f0f0; border: 1px solid #333;
      border-radius: 10px; padding: 12px; font-size: 12px;
      font-family: monospace; resize: none;
    }
    button {
      width: 100%; max-width: 360px; padding: 14px;
      background: #f0f0f0; color: #0a0a0a;
      border: none; border-radius: 10px;
      font-size: 16px; font-weight: 600; cursor: pointer;
    }
    button:active { opacity: 0.8; }
    .status {
      font-size: 13px; min-height: 20px; text-align: center;
      color: {% if ok %}#4ade80{% elif error %}#f87171{% else %}transparent{% endif %};
    }
    .steps { font-size: 12px; color: #555; text-align: left; max-width: 360px; line-height: 1.8; }
    .steps span { color: #888; }
  </style>
</head>
<body>
  <h1>▦ ShowUp Display</h1>
  {% if ok %}
    <p class="status">Display updated.</p>
  {% elif error %}
    <p class="status">{{ error }}</p>
  {% else %}
    <p class="sub">Paste your sync code from the ShowUp app.</p>
  {% endif %}
  <form method="POST" action="/sync-form">
    <textarea name="payload" placeholder='{"p":{"t":"..."},"e":[...],"ts":...}'
      autofocus>{{ payload or "" }}</textarea>
    <br><br>
    <button type="submit">Sync display</button>
  </form>
  <div class="steps">
    <span>1.</span> Open ShowUp in your regular browser<br>
    <span>2.</span> Tap <b>Copy iOS sync code</b> on the Feed page<br>
    <span>3.</span> Come back here and paste it above
  </div>
</body>
</html>"""


def create_app(on_payload: Callable[[dict], None]) -> Flask:
    app = Flask(__name__)
    app.config["PROPAGATE_EXCEPTIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = MAX_PAYLOAD_BYTES

    # CORS: /sync is reached from the ShowUp web app running on the user's
    # phone via the Pi's captive-portal origin. Restricting to the Pi origin
    # (http://10.42.0.1:8080) is tighter than "*" but keeps programmatic
    # callers on the same AP functional. Private-network preflight requires
    # the explicit Private-Network header added in after_request.
    CORS(
        app,
        resources={r"/sync": {"origins": [f"http://{PI_AP_IP}:{PORT}"]}},
    )

    sync_token = _load_sync_token()
    if not sync_token:
        log.warning(
            "No sync token configured — /sync will reject all writes. "
            "Set CLIPCAL_SYNC_TOKEN or run ap_setup.sh to provision %s.",
            SYNC_TOKEN_PATH,
        )

    def _token_ok(submitted: str | None) -> bool:
        if not sync_token or not submitted:
            return False
        return hmac.compare_digest(sync_token, submitted.strip())

    @app.after_request
    def add_private_network_header(response: Response) -> Response:
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    @app.before_request
    def captive_portal_intercept() -> Response | None:
        """Redirect Apple/Android connectivity-check hosts to the sync page."""
        host = request.headers.get("Host", "").split(":")[0]
        if host in _CAPTIVE_HOSTS:
            return redirect(f"http://{PI_AP_IP}:{PORT}/", 302)
        return None

    @app.get("/")
    def index() -> str:
        return render_template_string(_SYNC_PAGE, ok=False, error=None, payload=None)

    @app.post("/sync-form")
    def sync_form() -> str:
        """Form POST from the sync page (pastes payload text)."""
        # Captive-portal form accepts the token alongside the payload so the
        # user can paste both from the ShowUp app in one copy.
        submitted_token = request.form.get("token", "").strip()
        if not _token_ok(submitted_token):
            return render_template_string(
                _SYNC_PAGE, ok=False, error="Missing or invalid sync token.", payload=None
            )
        raw = request.form.get("payload", "").strip()
        try:
            payload = json.loads(raw)
            on_payload(payload)
            return render_template_string(_SYNC_PAGE, ok=True, error=None, payload=None)
        except json.JSONDecodeError:
            return render_template_string(
                _SYNC_PAGE, ok=False, error="Invalid sync code — copy it again from ShowUp.", payload=raw
            )
        except Exception as exc:
            log.exception("sync_form render error: %s", exc)
            return render_template_string(
                _SYNC_PAGE, ok=False, error="Display error — check Pi logs.", payload=raw
            )

    @app.post("/sync")
    def sync_json() -> Response:
        """JSON POST from programmatic callers (Capacitor app, curl, etc.)."""
        submitted = request.headers.get("X-Sync-Token", "")
        if not _token_ok(submitted):
            return Response("unauthorized", status=401)
        try:
            payload = request.get_json(force=True)
            if not payload:
                return Response("bad json", status=400)
            on_payload(payload)
            return Response("ok", status=200)
        except Exception as exc:
            log.exception("sync_json render error: %s", exc)
            return Response("error", status=500)

    @app.get("/status")
    def status() -> Response:
        return Response("ok", status=200, content_type="text/plain")

    return app


def start_in_thread(on_payload: Callable[[dict], None]) -> None:
    """Start the Flask server in a daemon thread. Returns immediately."""
    flask_app = create_app(on_payload)

    def _run() -> None:
        log.info("HTTP server listening on 0.0.0.0:%d", PORT)
        # Flask dev server is intentional: single-user Pi on an isolated AP
        # with hard payload cap + shared-secret auth. No gunicorn needed.
        flask_app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)

    thread = threading.Thread(target=_run, daemon=True, name="http-server")
    thread.start()
