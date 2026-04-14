#!/usr/bin/env python3
"""
ShowUppie Pi Zero — main entry point.

Wiring (Waveshare 2.13" V4 HAT — uses default GPIO SPI pins):
  RST  → GPIO 17   DC  → GPIO 25
  CS   → GPIO 8    BL  → GPIO 18 (not used on V4, tie to 3.3V)
  CLK  → GPIO 11   DIN → GPIO 10

Run:
  sudo python3 main.py

Requires:
  1. Waveshare e-Paper library cloned to ~/e-Paper
     git clone https://github.com/waveshareteam/e-Paper.git ~/e-Paper
  2. pip install -r requirements.txt
  3. SPI enabled: sudo raspi-config → Interface Options → SPI → Enable
"""

import asyncio
import logging
import signal
import sys
import os
import threading
import time as time_module

# Waveshare library — clone to ~/e-Paper and point this path at it
_WAVESHARE = os.path.expanduser("~/e-Paper/RaspberryPi_JetsonNano/python/lib")
if os.path.isdir(_WAVESHARE):
    sys.path.insert(0, _WAVESHARE)

try:
    from waveshare_epd import epd2in13_V4
except ImportError:
    print("ERROR: Waveshare library not found.")
    print("Clone it: git clone https://github.com/waveshareteam/e-Paper.git ~/e-Paper")
    sys.exit(1)

from ble_server import BleServer
from http_server import start_in_thread as start_http
from renderer import render_from_payload, render_waiting, render

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("main")

# Full refresh every N partial refreshes to clear e-ink ghosting
FULL_REFRESH_INTERVAL = 10


class ShowUppieDisplay:
    def __init__(self) -> None:
        self._epd = epd2in13_V4.EPD()
        self._partial_count = 0
        self._initialized = False
        self._last_payload: dict | None = None
        self._lock = threading.Lock()

    def init(self) -> None:
        log.info("Initializing e-ink display (full refresh)")
        self._epd.init()
        img = render_waiting()
        self._epd.display(self._epd.getbuffer(img))
        self._epd.sleep()
        self._initialized = True
        log.info("Display ready")

    def _do_refresh(self, img) -> None:
        """Low-level refresh — caller must hold self._lock."""
        buf = self._epd.getbuffer(img)
        self._partial_count += 1
        if self._partial_count % FULL_REFRESH_INTERVAL == 0:
            log.info("Full refresh (count=%d)", self._partial_count)
            self._epd.init()
            self._epd.display(buf)
        else:
            log.info("Fast refresh (count=%d)", self._partial_count)
            self._epd.init_fast()
            self._epd.display_fast(buf)
        self._epd.sleep()

    def update(self, payload: dict) -> None:
        """Render new payload to display."""
        with self._lock:
            self._last_payload = payload
            self._do_refresh(render_from_payload(payload))

    def refresh_time(self) -> None:
        """Re-render the current content with an updated clock. No-op if no payload yet."""
        with self._lock:
            if self._last_payload is None:
                img = render_waiting()
            else:
                img = render_from_payload(self._last_payload)
            self._do_refresh(img)

    def clear(self) -> None:
        with self._lock:
            self._epd.init()
            self._epd.Clear(0xFF)
            self._epd.sleep()


async def main() -> None:
    display = ShowUppieDisplay()
    display.init()

    def on_payload(payload: dict) -> None:
        log.info("Received payload — updating display")
        display.update(payload)

    # BLE — for Android / Chrome (optional — falls back to HTTP-only if unavailable)
    server = None
    try:
        server = BleServer(on_payload=on_payload)
        await server.start()
        log.info("BLE advertising as 'ShowUppie'")
    except Exception as exc:
        log.warning("BLE unavailable (%s) — running HTTP-only", exc)
        server = None

    # HTTP — for iOS / same-network browsers
    start_http(on_payload)

    # Clock thread — re-renders every 60 s so the time stays current
    def _clock_loop() -> None:
        while True:
            time_module.sleep(60)
            try:
                display.refresh_time()
            except Exception as exc:
                log.warning("Clock refresh failed: %s", exc)

    threading.Thread(target=_clock_loop, daemon=True, name="clock").start()
    log.info("Clock thread started — refreshing every 60s")

    # Graceful shutdown on SIGINT / SIGTERM
    loop = asyncio.get_event_loop()
    if server:
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda: asyncio.ensure_future(server.stop()))
    else:
        stop_event = asyncio.Event()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop_event.set)

    if server:
        log.info("Ready.  BLE: 'ShowUppie' · HTTP: 0.0.0.0:8080")
        await server.run_forever()
    else:
        log.info("Ready.  HTTP-only: 0.0.0.0:8080")
        await stop_event.wait()

    log.info("Shutting down")
    display.clear()


if __name__ == "__main__":
    asyncio.run(main())
