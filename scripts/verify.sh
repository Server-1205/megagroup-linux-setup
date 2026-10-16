#!/usr/bin/env bash
# ==============================================================================
# Megagroup Linux Setup - Verification & Health Check Script
# ==============================================================================

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}=== Megagroup Linux Setup: Diagnostic Check ===${NC}\n"

ERRORS=0

# 1. OpenVPN Connection Check
echo -ne "1. OpenVPN (NetworkManager)... "
if nmcli connection show --active 2>/dev/null | grep -q "megagroup"; then
    echo -e "${GREEN}${BOLD}CONNECTED (Active)${NC}"
elif systemctl is-active --quiet openvpn-client@megagroup 2>/dev/null; then
    echo -e "${GREEN}${BOLD}CONNECTED (systemd)${NC}"
elif nmcli connection show 2>/dev/null | grep -q "megagroup"; then
    echo -e "${YELLOW}Configured (Idle / Disconnected)${NC}"
else
    echo -e "${RED}NOT CONFIGURED${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 2. Corporate Network Accessibility
echo -ne "2. Corporate Network (staff.megagroup.ru)... "
if curl -s -m 3 -o /dev/null -w "%{http_code}" https://staff.megagroup.ru 2>/dev/null | grep -qE "200|301|302|401"; then
    echo -e "${GREEN}${BOLD}REACHABLE${NC}"
else
    echo -e "${YELLOW}Unreachable (VPN may be disconnected)${NC}"
fi

# 3. screenShotik Process Check
echo -ne "3. screenShotik Daemon... "
if pgrep -f "screenshotik.*hidden" &>/dev/null || pgrep -f "screenshotik" &>/dev/null; then
    PID=$(pgrep -f "screenshotik" | head -n 1)
    echo -e "${GREEN}${BOLD}RUNNING (PID: ${PID})${NC}"
else
    echo -e "${RED}NOT RUNNING${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 4. screenShotik Config & Token
echo -ne "4. screenShotik Authorization... "
CONF_FILE="${HOME}/.config/screenShotik/shotik.json"
if [[ -f "${CONF_FILE}" ]] && grep -q '"authenticated": true' "${CONF_FILE}"; then
    echo -e "${GREEN}${BOLD}AUTHENTICATED (JWT Active)${NC}"
else
    echo -e "${RED}NOT AUTHENTICATED (${CONF_FILE})${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 5. Hotkeys Check (Hyprland / Omarchy)
echo -ne "5. Hotkeys (Hyprland / Omarchy)... "
if command -v hyprctl &>/dev/null && hyprctl binds 2>/dev/null | grep -qi "screenshotik"; then
    echo -e "${GREEN}${BOLD}ACTIVE (Shift+F1 / Print bound)${NC}"
else
    echo -e "${YELLOW}Not detected in hyprctl (check bindings.lua)${NC}"
fi

echo
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}${BOLD} Все ключевые компоненты работают штатно!${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}⚠ Обнаружены предупреждения или ошибки ($ERRORS).${NC}"
    exit 1
fi
