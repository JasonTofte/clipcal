#!/usr/bin/env python3
"""
ClipCal Pi Zero — main entry point.

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
from renderer import render_from_payload, render_waiting

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("main")

# Full refresh every N partial refreshes to clear e-ink ghosting
FULL_REFRESH_INTERVAL = 10


class ClipCalDisplay:
    def __init__(self) -> None:
        self._epd = epd2in13_V4.EPD()
        self._partial_count = 0
        self._initialized = False

    def init(self) -> None:
        log.info("Initializing e-ink display (full refresh)")
        self._epd.init()
        img = render_waiting()
        self._epd.display(self._epd.getbuffer(img))
        self._epd.sleep()
        self._initialized = True
        log.info("Display ready")

    def update(self, payload: dict) -> None:
        """Render payload to display. Uses partial refresh most of the time."""
        img = render_from_payload(payload)
        buf = self._epd.getbuffer(img)

        self._partial_count += 1
        do_full = (self._partial_count % FULL_REFRESH_INTERVAL == 0)

        if do_full:
            log.info("Full refresh (count=%d)", self._partial_count)
            self._epd.init()
            self._epd.display(buf)
        else:
            log.info("Fast refresh (count=%d)", self._partial_count)
            self._epd.init_fast()
            self._epd.display_fast(buf)

        self._epd.sleep()

    def clear(self) -> None:
        self._epd.init()
        self._epd.Clear(0xFF)
        self._epd.sleep()


async def main() -> None:
    display = ClipCalDisplay()
    display.init()

    def on_payload(payload: dict) -> None:
        log.info("Received payload — updating display")
        display.update(payload)

    # BLE — for Android / Chrome (optional — falls back to HTTP-only if unavailable)
    server = None
    try:
        server = BleServer(on_payload=on_payload)
        await server.start()
        log.info("BLE advertising as 'ClipCal'")
    except Exception as exc:
        log.warning("BLE unavailable (%s) — running HTTP-only", exc)
        server = None

    # HTTP — for iOS / same-network browsers
    start_http(on_payload)

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
        log.info("Ready.  BLE: 'ClipCal' · HTTP: 0.0.0.0:8080")
        await server.run_forever()
    else:
        log.info("Ready.  HTTP-only: 0.0.0.0:8080")
        await stop_event.wait()

    log.info("Shutting down")
    display.clear()


if __name__ == "__main__":
    asyncio.run(main())
