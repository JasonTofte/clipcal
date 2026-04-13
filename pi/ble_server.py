"""
BLE GATT peripheral for ClipCal e-ink display.

Service:  6e400001-b5a3-f393-e0a9-e50e24dcca9e
  Write:  6e400002-b5a3-f393-e0a9-e50e24dcca9e  (phone → Pi, JSON payload)
  Notify: 6e400003-b5a3-f393-e0a9-e50e24dcca9e  (Pi → phone, status string)

Run via main.py — do not execute directly.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Optional

from bless import BlessServer, BlessGATTCharacteristic
from bless.backends.characteristic import (
    GATTCharacteristicProperties,
    GATTAttributePermissions,
)

log = logging.getLogger(__name__)

SERVICE_UUID    = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
WRITE_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
READ_CHAR_UUID  = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


class BleServer:
    """
    Wraps bless into a simple async server.

    Usage:
        server = BleServer(on_payload=my_callback)
        await server.start()
        await server.run_forever()   # blocks until Ctrl-C
        await server.stop()
    """

    def __init__(self, on_payload: Callable[[dict], None]):
        self._on_payload = on_payload
        self._server: Optional[BlessServer] = None
        self._stop_event = asyncio.Event()

    async def start(self) -> None:
        loop = asyncio.get_event_loop()
        self._server = BlessServer(name="ClipCal", loop=loop)
        self._server.read_request_func = self._handle_read
        self._server.write_request_func = self._handle_write

        await self._server.add_new_service(SERVICE_UUID)

        # Write characteristic — phone sends JSON here
        await self._server.add_new_characteristic(
            SERVICE_UUID,
            WRITE_CHAR_UUID,
            GATTCharacteristicProperties.write | GATTCharacteristicProperties.write_without_response,
            None,
            GATTAttributePermissions.writeable,
        )

        # Read/notify characteristic — Pi sends status back
        await self._server.add_new_characteristic(
            SERVICE_UUID,
            READ_CHAR_UUID,
            GATTCharacteristicProperties.read | GATTCharacteristicProperties.notify,
            b"ready",
            GATTAttributePermissions.readable,
        )

        await self._server.start()
        log.info("BLE advertising as 'ClipCal'")

    async def run_forever(self) -> None:
        await self._stop_event.wait()

    async def stop(self) -> None:
        self._stop_event.set()
        if self._server:
            await self._server.stop()

    def send_status(self, msg: str) -> None:
        """Update the readable status characteristic (e.g. 'ok', 'error')."""
        if self._server:
            char = self._server.get_characteristic(READ_CHAR_UUID)
            if char:
                char.value = msg.encode()
                self._server.update_value(SERVICE_UUID, READ_CHAR_UUID)

    # ── internal handlers ────────────────────────────────────────────────────

    def _handle_read(self, characteristic: BlessGATTCharacteristic, **_: Any) -> bytearray:
        return bytearray(characteristic.value or b"ready")

    def _handle_write(self, characteristic: BlessGATTCharacteristic, value: Any, **_: Any) -> None:
        if characteristic.uuid.lower() != WRITE_CHAR_UUID:
            return

        raw = bytes(value) if not isinstance(value, (bytes, bytearray)) else value
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            log.warning("BLE write: bad JSON — %s", exc)
            self.send_status("error:json")
            return

        log.info("BLE write received: %d bytes", len(raw))
        try:
            self._on_payload(payload)
            self.send_status("ok")
        except Exception as exc:
            log.exception("on_payload raised: %s", exc)
            self.send_status("error:render")
