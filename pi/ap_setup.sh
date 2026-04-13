#!/usr/bin/env bash
# Configure Pi Zero 2W as a WiFi access point (no internet, no router required).
#
# After running this:
#   SSID:     ClipCal-Display
#   Password: clipcal2026
#   Pi IP:    10.42.0.1
#   Sync URL: http://10.42.0.1:8080/
#
# iOS will show a captive-portal banner automatically when connecting.
# Android Chrome opens the portal too; or navigate there manually.
#
# To UNDO: sudo bash ap_setup.sh --undo
set -euo pipefail

SSID="ClipCal-Display"
PASSPHRASE="clipcal2026"
PI_IP="10.42.0.1"
IFACE="wlan0"

if [[ "${1:-}" == "--undo" ]]; then
  echo "Removing AP configuration..."
  sudo systemctl stop hostapd dnsmasq 2>/dev/null || true
  sudo systemctl disable hostapd dnsmasq 2>/dev/null || true
  sudo rm -f /etc/hostapd/hostapd.conf /etc/dnsmasq.d/clipcal.conf
  sudo ip addr del "${PI_IP}/24" dev "${IFACE}" 2>/dev/null || true
  echo "AP removed. Reboot to restore normal WiFi."
  exit 0
fi

echo "=== ClipCal WiFi AP setup ==="
echo "SSID: ${SSID}  Password: ${PASSPHRASE}  IP: ${PI_IP}"

# 1. Install deps
sudo apt-get update -qq
sudo apt-get install -y hostapd dnsmasq

# 2. Stop wpa_supplicant managing this interface (we take it over)
sudo systemctl stop wpa_supplicant 2>/dev/null || true

# 3. Assign static IP to wlan0
sudo ip addr flush dev "${IFACE}"
sudo ip addr add "${PI_IP}/24" dev "${IFACE}"
sudo ip link set "${IFACE}" up

# 4. hostapd config
sudo tee /etc/hostapd/hostapd.conf > /dev/null <<EOF
interface=${IFACE}
driver=nl80211
ssid=${SSID}
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=${PASSPHRASE}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
EOF

# Point hostapd at config
sudo sed -i 's|^#\?DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd

# 5. dnsmasq config — spoof ALL DNS to Pi IP so iOS triggers captive portal
sudo tee /etc/dnsmasq.d/clipcal.conf > /dev/null <<EOF
# ClipCal AP — DHCP + DNS spoof for captive portal
interface=${IFACE}
dhcp-range=10.42.0.10,10.42.0.50,12h
# Redirect all DNS queries to Pi so iOS shows captive portal banner
address=/#/${PI_IP}
EOF

# 6. Provision sync token — /sync endpoints require this in X-Sync-Token.
#    Token is baked into a root-only file read by pi/main.py at startup.
SYNC_TOKEN_FILE="/etc/clipcal/sync_token"
if [[ ! -s "${SYNC_TOKEN_FILE}" ]]; then
  sudo mkdir -p /etc/clipcal
  sudo sh -c "head -c 24 /dev/urandom | base64 | tr -d '=+/\n' > '${SYNC_TOKEN_FILE}'"
  sudo chmod 600 "${SYNC_TOKEN_FILE}"
fi
echo "Sync token saved to ${SYNC_TOKEN_FILE} (show with: sudo cat ${SYNC_TOKEN_FILE})"

# 7. Enable and start
sudo systemctl unmask hostapd
sudo systemctl enable hostapd dnsmasq
sudo systemctl restart dnsmasq
sudo systemctl start hostapd

echo ""
echo "=== AP running ==="
echo "Connect your phone to '${SSID}' (password: ${PASSPHRASE})"
echo "iOS will show 'Sign in to ${SSID}' — tap it to open the sync page."
echo "Android: open http://${PI_IP}:8080/ in Chrome."
echo ""
echo "Start the display server in another terminal:"
echo "  sudo pi/.venv/bin/python3 pi/main.py"
