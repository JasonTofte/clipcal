"""
ClipCal e-ink display renderer.
Target: Waveshare 2.13" V4 — 250×122px landscape, black/white.

Layout (pixel rows, landscape):
  y=0–38   PRIORITY section: bold time+loc line, then title line
  y=38     1px divider
  y=40–122 EVENT LIST: up to 6 compact rows (time · title · loc)
"""

import os
from dataclasses import dataclass
from datetime import datetime
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
FONT_CLOCK = _load_font(_FONT_CONDENSED, 9)                  # current time (bottom-right)


def _current_time_str() -> str:
    now = datetime.now()
    h = now.hour
    m = now.minute
    suffix = 'p' if h >= 12 else 'a'
    h12 = h % 12 or 12
    return f"{h12}:{m:02d}{suffix}"


def _time_bar_text() -> str:
    now = datetime.now()
    time_str = _current_time_str()
    date_str = now.strftime("%a %b %-d")  # e.g. "Tue Apr 15"
    return time_str, date_str


@dataclass
class PriorityEvent:
    title: str
    time: str
    loc: str
    duration: Optional[str] = None
    starred: bool = False


@dataclass
class EventRow:
    time: str
    title: str
    loc: Optional[str] = None
    past: bool = False
    starred: bool = False


BAR_H = 13  # height of the top time/date bar

def render(priority: PriorityEvent, events: list[EventRow]) -> Image.Image:
    """
    Returns a 250×122 '1'-mode (1-bit) PIL Image ready for the Waveshare driver.
    Black pixels = 0, White pixels = 255.

    Layout:
      y=0–12   TIME BAR: black background, white time (left) + date (right)
      y=13     1px separator
      y=14–51  PRIORITY section
      y=52     1px divider
      y=54–122 EVENT LIST
    """
    img = Image.new("1", (W, H), 255)
    draw = ImageDraw.Draw(img)

    # ── Top time/date bar ─────────────────────────────────────────────────────
    draw.rectangle([0, 0, W, BAR_H - 1], fill=0)
    time_str, date_str = _time_bar_text()
    draw.text((3, 2), time_str, font=FONT_CLOCK, fill=255)
    dw = _text_width(date_str, FONT_CLOCK)
    draw.text((W - dw - 3, 2), date_str, font=FONT_CLOCK, fill=255)

    # ── Priority section ──────────────────────────────────────────────────────
    P = BAR_H + 1  # y offset for priority section
    draw.rectangle([0, P + 2, 2, P + 34], fill=0)  # left accent bar

    meta_parts = [priority.time]
    if priority.loc:
        meta_parts.append(priority.loc)
    if priority.duration:
        meta_parts.append(priority.duration)
    meta_line = "  ·  ".join(meta_parts)
    draw.text((7, P + 2), meta_line, font=FONT_PRIORITY_TIME, fill=0)

    raw_title = ("* " + priority.title) if priority.starred else priority.title
    title = _fit(raw_title, FONT_PRIORITY_TITLE, W - 9)
    draw.text((7, P + 17), title, font=FONT_PRIORITY_TITLE, fill=0)

    # ── Divider ───────────────────────────────────────────────────────────────
    DIV_Y = P + 38
    draw.line([(0, DIV_Y), (W - 1, DIV_Y)], fill=0, width=1)

    # ── Event list ────────────────────────────────────────────────────────────
    y = DIV_Y + 3
    row_h = 12

    for row in events:
        if y + 10 > H:
            break
        if row.past:
            time_label = f"~{row.time}"
        elif row.starred:
            time_label = f"*{row.time}"
        else:
            time_label = row.time
        tw = _text_width(time_label, FONT_EVENT)
        draw.text((28 - tw, y), time_label, font=FONT_EVENT, fill=0)

        body = row.title
        if row.loc:
            body = f"{body}  {row.loc}"
        body = _fit(body, FONT_EVENT, W - 32)
        draw.text((32, y), body, font=FONT_EVENT, fill=0)

        y += row_h

    return img


def render_waiting() -> Image.Image:
    """Splash shown on startup before any sync data arrives."""
    img = Image.new("1", (W, H), 255)
    draw = ImageDraw.Draw(img)
    font = _load_font(_FONT_CONDENSED_BOLD, 14)
    small = _load_font(_FONT_CONDENSED, 10)
    # Top bar
    draw.rectangle([0, 0, W, BAR_H - 1], fill=0)
    time_str, date_str = _time_bar_text()
    draw.text((3, 2), time_str, font=FONT_CLOCK, fill=255)
    dw = _text_width(date_str, FONT_CLOCK)
    draw.text((W - dw - 3, 2), date_str, font=FONT_CLOCK, fill=255)
    # Body
    draw.text((10, 44), "ShowUppie", font=font, fill=0)
    draw.text((10, 62), "waiting for phone…", font=small, fill=0)
    return img


def render_from_payload(payload: dict) -> Image.Image:
    """Parse the BLE JSON payload and render."""
    p = payload.get("p", {})
    priority = PriorityEvent(
        title=p.get("t", "—"),
        time=p.get("tm", ""),
        loc=p.get("l", ""),
        duration=p.get("d"),
        starred=bool(p.get("s")),
    )
    events = [
        EventRow(time=e.get("tm", ""), title=e.get("t", ""), loc=e.get("l"), past=bool(e.get("x")), starred=bool(e.get("s")))
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
