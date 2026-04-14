#!/usr/bin/env bash
# ClipCal Pi Zero setup — run once after flashing Raspberry Pi OS Lite (64-bit)
# Tested on Pi Zero 2 W with Raspberry Pi OS Bookworm
set -euo pipefail

echo "=== ClipCal Pi Zero setup ==="

# 1. Enable SPI (required for e-ink display)
if ! grep -q "^dtparam=spi=on" /boot/firmware/config.txt 2>/dev/null &&
   ! grep -q "^dtparam=spi=on" /boot/config.txt 2>/dev/null; then
  echo "Enabling SPI..."
  sudo raspi-config nonint do_spi 0
else
  echo "SPI already enabled"
fi

# 2. System deps
echo "Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y python3-pip python3-venv git \
  libopenjp2-7 libtiff5 libatlas-base-dev bluetooth bluez

# 3. Waveshare e-Paper library
if [ ! -d "$HOME/e-Paper" ]; then
  echo "Cloning Waveshare e-Paper library..."
  git clone --depth 1 https://github.com/waveshareteam/e-Paper.git "$HOME/e-Paper"
else
  echo "Waveshare library already cloned"
fi

# 4. Python venv + deps
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$SCRIPT_DIR/requirements.txt"

# 5. Bluetooth permissions — allow running without sudo
sudo usermod -a -G bluetooth "$USER"
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

echo ""
echo "=== Setup complete ==="
echo ""
echo "To start the display server:"
echo "  source $VENV/bin/activate"
echo "  sudo $VENV/bin/python3 $SCRIPT_DIR/main.py"
echo ""
echo "NOTE: sudo is required for BLE peripheral mode on Linux."
echo "If you prefer to run without sudo, add 'CapabilityBoundingSet=CAP_NET_ADMIN'"
echo "to a systemd unit (see Raspberry Pi BlueZ docs)."
