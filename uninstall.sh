#!/usr/bin/env bash
# ==============================================================================
# Megagroup Linux Setup - Clean Uninstaller
# ==============================================================================

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

if [[ "${EUID}" -ne 0 ]]; then
    echo -e "${RED}Скрипт должен быть запущен с правами root: sudo ./uninstall.sh${NC}"
    exit 1
fi

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

echo -e "${BOLD}Удаление компонентов Megagroup...${NC}"

# 1. Остановка процессов
pkill -u "$TARGET_USER" -f "screenshotik" 2>/dev/null || true
nmcli connection down "megagroup" 2>/dev/null || true
systemctl stop openvpn-client@megagroup 2>/dev/null || true
systemctl disable openvpn-client@megagroup 2>/dev/null || true

# 2. Удаление NetworkManager подключения
nmcli connection delete "megagroup" 2>/dev/null || true

# 3. Удаление файлов OpenVPN
rm -f /etc/openvpn/client/megagroup.conf
rm -f /etc/openvpn/client/megagroup.auth
rm -f /etc/openvpn/update-systemd-resolved
rm -f /usr/local/bin/megagroup-vpn
rm -f /usr/share/applications/megagroup-vpn.desktop

# 4. Удаление screenShotik
rm -rf /usr/local/share/screenShotik
rm -f /usr/local/bin/screenshotik
rm -f "${TARGET_HOME}/.local/bin/screenshotik"
rm -f /usr/share/applications/screenShotik.desktop
rm -f /usr/share/icons/hicolor/512x512/apps/screenShotik.png
rm -f "${TARGET_HOME}/.config/autostart/screenShotik.desktop"

# 5. Очистка bindings.lua в Hyprland
OMARCHY_BINDINGS="${TARGET_HOME}/.config/hypr/bindings.lua"
if [[ -f "$OMARCHY_BINDINGS" ]]; then
    sed -i '/Megagroup screenShotik shortcuts/,+8d' "$OMARCHY_BINDINGS" 2>/dev/null || true
    su - "$TARGET_USER" -c "hyprctl reload 2>/dev/null || true" || true
fi

echo -e "${GREEN}${BOLD}Все компоненты Megagroup успешно удалены.${NC}"
