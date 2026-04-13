"""
ClipCal e-ink display renderer.
Target: Waveshare 2.13" V4 — 250×122px landscape, black/white.

Layout (pixel rows, landscape):
  y=0–38   PRIORITY section: bold time+loc line, then title line
  y=38     1px divider
  y=40–122 EVENT LIST: up to 6 compact rows (time · title · loc)
"""

import json
import os
from dataclasses import dataclass
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

# Display dimensions (landscape: 250 wide, 122 tall)
W, H = 250, 122

# Fonts — DejaVu is pre-installed on Raspberry Pi OS
_FONT_DIR = "/usr/share/fonts/truetype/dejavu"
_FONT_CONDENSED = os.path.join(_FONT_DIR, "DejaVuSansCondensed.ttf")
_FONT_CONDENSED_BOLD = os.path.join(_FONT_DIR, "DejaVuSansCondensed-Bold.ttf")
_FONT_REGULAR = os.path.join(_FONT_DIR, "DejaVuSans.ttf")


def _load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        # Fallback to PIL default (tiny but always available)
        return ImageFont.load_default()


# Pre-load fonts at module level
FONT_PRIORITY_TIME = _load_font(_FONT_CONDENSED_BOLD, 13)   # bold time+loc in priority
FONT_PRIORITY_TITLE = _load_font(_FONT_CONDENSED, 12)       # event title in priority
FONT_EVENT = _load_font(_FONT_CONDENSED, 10)                 # event list rows


@dataclass
class PriorityEvent:
    title: str
    time: str
    loc: str
    duration: Optional[str] = None


@dataclass
class EventRow:
    time: str
    title: str
    loc: Optional[str] = None


def render(priority: PriorityEvent, events: list[EventRow]) -> Image.Image:
    """
    Returns a 250×122 '1'-mode (1-bit) PIL Image ready for the Waveshare driver.
    Black pixels = 0, White pixels = 255.
    """
    img = Image.new("1", (W, H), 255)  # white background
    draw = ImageDraw.Draw(img)

    # ── Priority section ──────────────────────────────────────────────────────
    # Left accent bar (3px wide)
    draw.rectangle([0, 2, 2, 35], fill=0)

    # Line 1: time  ·  location  ·  duration
    meta_parts = [priority.time]
    if priority.loc:
        meta_parts.append(priority.loc)
    if priority.duration:
        meta_parts.append(priority.duration)
    meta_line = "  ·  ".join(meta_parts)
    draw.text((7, 3), meta_line, font=FONT_PRIORITY_TIME, fill=0)

    # Line 2: event title (truncated to fit)
    title = _fit(priority.title, FONT_PRIORITY_TITLE, W - 9)
    draw.text((7, 19), title, font=FONT_PRIORITY_TITLE, fill=0)

    # ── Divider ───────────────────────────────────────────────────────────────
    draw.line([(0, 38), (W - 1, 38)], fill=0, width=1)

    # ── Event list ────────────────────────────────────────────────────────────
    # Each row: "HH:MM  TITLE · LOC"
    # Column widths: time=28px, rest=W-30px
    y = 42
    row_h = 13  # 10px font + 3px gap

    for row in events[:6]:  # max 6 rows before we hit y=120
        # Time column (right-aligned in 28px)
        tw = _text_width(row.time, FONT_EVENT)
        draw.text((28 - tw, y), row.time, font=FONT_EVENT, fill=0)

        # Title + loc
        body = row.title
        if row.loc:
            body = f"{body}  {row.loc}"
        body = _fit(body, FONT_EVENT, W - 32)
        draw.text((32, y), body, font=FONT_EVENT, fill=0)

        y += row_h
        if y + 10 > H:
            break

    return img


def render_waiting() -> Image.Image:
    """Splash shown on startup before any BLE data arrives."""
    img = Image.new("1", (W, H), 255)
    draw = ImageDraw.Draw(img)
    font = _load_font(_FONT_CONDENSED_BOLD, 14)
    small = _load_font(_FONT_CONDENSED, 10)
    draw.text((10, 40), "ClipCal", font=font, fill=0)
    draw.text((10, 58), "waiting for phone…", font=small, fill=0)
    return img


def render_from_payload(payload: dict) -> Image.Image:
    """Parse the BLE JSON payload and render."""
    p = payload.get("p", {})
    priority = PriorityEvent(
        title=p.get("t", "—"),
        time=p.get("tm", ""),
        loc=p.get("l", ""),
        duration=p.get("d"),
    )
    events = [
        EventRow(time=e.get("tm", ""), title=e.get("t", ""), loc=e.get("l"))
        for e in payload.get("e", [])
    ]
    return render(priority, events)


# ── helpers ───────────────────────────────────────────────────────────────────

def _text_width(text: str, font: ImageFont.FreeTypeFont) -> int:
    """Returns pixel width of text with the given font."""
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0]


def _fit(text: str, font: ImageFont.FreeTypeFont, max_px: int) -> str:
    """Truncate text with ellipsis until it fits within max_px pixels."""
    if _text_width(text, font) <= max_px:
        return text
    while len(text) > 1 and _text_width(text + "…", font) > max_px:
        text = text[:-1]
    return text + "…"
