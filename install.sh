#!/usr/bin/env bash
# ==============================================================================
# Megagroup Linux Setup - 1-Click Universal Installer
# Compatible with: Omarchy Linux (Arch), Debian/Ubuntu, Fedora, openSUSE
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VPN_USER="server.asanov.4518"
VPN_PASS="r7FX8yy36"
SKIP_VPN=false
SKIP_SHOTIK=false
UNATTENDED=false

print_banner() {
    cat << "EOF"
  __  __                                                    
 |  \/  | ___  __ _  __ _  __ _ _ __ ___  _   _ _ __  (_) ___ 
 | |\/| |/ _ \/ _` |/ _` |/ _` | '__/ _ \| | | | '_ \ | |/ _ \
 | | | |  __/ (_| | (_| | (_| | | | (_) | |_| | |_) || |  __/
 |_| |_|\___|\__, |\__,_|\__, |_|  \___/ \__,_| .__/ |_|\___|
             |___/       |___/                |_|            
 Megagroup Linux Setup: 1-Click OpenVPN & screenShotik
EOF
}

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

show_help() {
    cat << EOF
Использование: sudo ./install.sh [ОПЦИИ]

Опции:
  --vpn-only       Установить и настроить только OpenVPN
  --shotik-only    Установить и настроить только screenShotik
  --unattended     Автоматическая тихая установка без интерактивных вопросов
  --vpn-user USER  Логин OpenVPN (по умолчанию: ${VPN_USER})
  --vpn-pass PASS  Пароль OpenVPN (по умолчанию: сохранённый пароль)
  -h, --help       Показать эту справку
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --vpn-only) SKIP_SHOTIK=true; shift ;;
        --shotik-only) SKIP_VPN=true; shift ;;
        --unattended|-y) UNATTENDED=true; shift ;;
        --vpn-user) VPN_USER="$2"; shift 2 ;;
        --vpn-pass) VPN_PASS="$2"; shift 2 ;;
        -h|--help) show_help; exit 0 ;;
        *) log_error "Неизвестный параметр: $1"; show_help; exit 1 ;;
    esac
done

if [[ "${EUID}" -ne 0 ]]; then
    log_error "Скрипт должен быть запущен с правами root: sudo ./install.sh"
    exit 1
fi

print_banner

# Определение пользователя рабочего стола
TARGET_USER="${SUDO_USER:-$USER}"
if [[ "$TARGET_USER" == "root" ]]; then
    REGULAR_USER="$(awk -F: '$3 >= 1000 && $3 < 60000 {print $1; exit}' /etc/passwd || true)"
    if [[ -n "$REGULAR_USER" ]]; then
        TARGET_USER="$REGULAR_USER"
    fi
fi
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
log_info "Целевой пользователь рабочего стола: ${BOLD}${TARGET_USER}${NC} (${TARGET_HOME})"

# Определение дистрибутива
DISTRO_ID="unknown"
DISTRO_LIKE=""
if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_LIKE="${ID_LIKE:-}"
fi
log_info "Операционная система: ${BOLD}${DISTRO_ID}${NC} (like: ${DISTRO_LIKE:-none})"

install_packages() {
    log_info "Установка системных зависимостей..."
    if [[ "$DISTRO_ID" =~ (arch|omarchy|manjaro|endeavouros) ]] || [[ "$DISTRO_LIKE" =~ arch ]]; then
        pacman -Sy --noconfirm --needed \
            openvpn \
            networkmanager \
            networkmanager-openvpn \
            libnotify \
            grim \
            slurp \
            wl-clipboard \
            xclip || true
    elif [[ "$DISTRO_ID" =~ (ubuntu|debian|linuxmint|pop) ]] || [[ "$DISTRO_LIKE" =~ debian ]]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y --no-install-recommends \
            openvpn \
            network-manager-openvpn \
            network-manager-openvpn-gnome \
            libnotify-bin \
            wl-clipboard \
            xclip || true
    elif [[ "$DISTRO_ID" =~ (fedora|rhel|centos) ]] || [[ "$DISTRO_LIKE" =~ fedora ]]; then
        dnf install -y \
            openvpn \
            NetworkManager-openvpn \
            NetworkManager-openvpn-gnome \
            libnotify \
            wl-clipboard \
            xclip || true
    elif [[ "$DISTRO_ID" =~ (opensuse|suse) ]]; then
        zypper install -y \
            openvpn \
            NetworkManager-openvpn \
            libnotify-tools \
            wl-clipboard \
            xclip || true
    fi
    log_success "Системные зависимости готовы."
}

setup_openvpn() {
    log_info "Настройка корпоративного OpenVPN Megagroup..."
    local vpn_dir="/etc/openvpn/client"
    local dst_conf="${vpn_dir}/megagroup.conf"
    local auth_file="${vpn_dir}/megagroup.auth"
    local nm_dns_script="/etc/openvpn/update-systemd-resolved"

    mkdir -p "$vpn_dir"

    # 1. DNS script для systemd-resolved
    if [[ -f "${SCRIPT_DIR}/openvpn/update-systemd-resolved" ]]; then
        cp "${SCRIPT_DIR}/openvpn/update-systemd-resolved" "$nm_dns_script"
        chmod 755 "$nm_dns_script"
    fi

    # 2. Файл конфигурации megagroup.conf
    cp "${SCRIPT_DIR}/openvpn/megagroup.ovpn" "$dst_conf"
    chmod 644 "$dst_conf"

    # 3. Файл учетных данных
    cat << EOF > "$auth_file"
${VPN_USER}
${VPN_PASS}
EOF
    chmod 600 "$auth_file"
    log_success "Учетные данные сохранены в ${auth_file} (${VPN_USER})"

    # 4. Интеграция с NetworkManager (если активен)
    if command -v nmcli &>/dev/null && systemctl is-active --quiet NetworkManager; then
        log_info "Настройка профиля в NetworkManager..."
        nmcli connection delete "megagroup" 2>/dev/null || true

        # Временный профиль без net_gateway для чистого импорта
        local tmp_ovpn
        tmp_ovpn="$(mktemp /tmp/megagroup_nm_XXXXXX.ovpn)"
        grep -v "net_gateway" "$dst_conf" > "$tmp_ovpn"

        if nmcli connection import type openvpn file "$tmp_ovpn" 2>/dev/null; then
            nmcli connection modify "megagroup" vpn.user-name "$VPN_USER" 2>/dev/null || true
            nmcli connection modify "megagroup" vpn.secrets "password=${VPN_PASS}" 2>/dev/null || true
            nmcli connection modify "megagroup" +vpn.data "password-flags=0" 2>/dev/null || true
            nmcli connection modify "megagroup" +vpn.data "data-ciphers=DEFAULT:BF-CBC" 2>/dev/null || true
            nmcli connection modify "megagroup" connection.autoconnect no 2>/dev/null || true
            log_success "Профиль 'megagroup' успешно импортирован в NetworkManager (пароль сохранён)."
        else
            log_warn "Импорт через nmcli не удался. Доступен systemd unit."
        fi
        rm -f "$tmp_ovpn"
    fi

    # 5. CLI утилита megagroup-vpn и desktop-ярлык
    if [[ -f "${SCRIPT_DIR}/openvpn/megagroup-vpn" ]]; then
        cp "${SCRIPT_DIR}/openvpn/megagroup-vpn" /usr/local/bin/megagroup-vpn
        chmod 755 /usr/local/bin/megagroup-vpn
    fi
    if [[ -f "${SCRIPT_DIR}/openvpn/megagroup-vpn.desktop" ]]; then
        mkdir -p /usr/share/applications
        cp "${SCRIPT_DIR}/openvpn/megagroup-vpn.desktop" /usr/share/applications/megagroup-vpn.desktop
        chmod 644 /usr/share/applications/megagroup-vpn.desktop
    fi

    # 6. systemd service reload
    systemctl daemon-reload 2>/dev/null || true
    log_success "OpenVPN Megagroup настроен."
}

setup_screenshotik() {
    log_info "Настройка нативного клиента screenShotik..."

    local install_dir="/usr/local/share/screenShotik"
    local user_config_dir="${TARGET_HOME}/.config/screenShotik"
    local user_autostart_dir="${TARGET_HOME}/.config/autostart"
    local bin_path="/usr/local/bin/screenshotik"

    mkdir -p "$install_dir/resources"
    mkdir -p "$user_config_dir"
    mkdir -p "$user_autostart_dir"
    mkdir -p /usr/share/applications
    mkdir -p /usr/share/icons/hicolor/512x512/apps

    # 1. Копирование готового app.asar
    if [[ -f "${SCRIPT_DIR}/screenshotik/resources/app.asar" ]]; then
        cp "${SCRIPT_DIR}/screenshotik/resources/app.asar" "$install_dir/resources/app.asar"
    elif [[ -f "${TARGET_HOME}/.local/share/screenShotik/resources/app.asar" ]]; then
        cp "${TARGET_HOME}/.local/share/screenShotik/resources/app.asar" "$install_dir/resources/app.asar"
    fi

    # 2. Поиск или копирование исполняемого файла Electron
    if [[ -f "/home/server/.local/share/screenShotik/screenshotik" && ! -f "$install_dir/screenshotik" ]]; then
        cp -r /home/server/.local/share/screenShotik/. "$install_dir/" 2>/dev/null || true
    fi

    # 3. Исполняемый лончер /usr/local/bin/screenshotik
    if [[ -f "${SCRIPT_DIR}/screenshotik/bin/screenshotik" ]]; then
        cp "${SCRIPT_DIR}/screenshotik/bin/screenshotik" "$bin_path"
    else
        cat << "EOF" > "$bin_path"
#!/usr/bin/env bash
exec /usr/local/share/screenShotik/screenshotik --no-sandbox --no-zygote "$@"
EOF
    fi
    chmod 755 "$bin_path"

    # Также делаем ссылку в ~/.local/bin целевого пользователя
    mkdir -p "${TARGET_HOME}/.local/bin"
    ln -sf "$bin_path" "${TARGET_HOME}/.local/bin/screenshotik"
    chown -h "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.local/bin/screenshotik" 2>/dev/null || true

    # 4. Иконка и desktop-файл
    if [[ -f "${SCRIPT_DIR}/screenshotik/screenShotik.png" ]]; then
        cp "${SCRIPT_DIR}/screenshotik/screenShotik.png" /usr/share/icons/hicolor/512x512/apps/screenShotik.png
    fi

    cat << EOF > /usr/share/applications/screenShotik.desktop
[Desktop Entry]
Type=Application
Name=screenShotik
Comment=Megagroup Screenshot app
Exec=${bin_path}
Icon=screenShotik
Terminal=false
Categories=Utility;Graphics;
StartupWMClass=screenShotik
X-GNOME-UsesNotifications=true
EOF
    chmod 644 /usr/share/applications/screenShotik.desktop

    # Автозапуск при входе
    cat << EOF > "${user_autostart_dir}/screenShotik.desktop"
[Desktop Entry]
Type=Application
Name=screenShotik
Exec=${bin_path} --hidden
Icon=screenShotik
Terminal=false
Categories=Utility;Graphics;
StartupWMClass=screenShotik
X-GNOME-Autostart-enabled=true
EOF
    chown "${TARGET_USER}:${TARGET_USER}" "${user_autostart_dir}/screenShotik.desktop"

    # 5. Пользовательский конфиг shotik.json
    local user_conf="${user_config_dir}/shotik.json"
    if [[ ! -f "$user_conf" ]]; then
        if [[ -f "${SCRIPT_DIR}/screenshotik/shotik.json" ]]; then
            cp "${SCRIPT_DIR}/screenshotik/shotik.json" "$user_conf"
        else
            cp "${SCRIPT_DIR}/screenshotik/shotik.json.template" "$user_conf"
        fi
        chown -R "${TARGET_USER}:${TARGET_USER}" "$user_config_dir"
    fi

    # 6. Настройка горячих клавиш (Hyprland / Omarchy / Sway)
    setup_hotkeys

    # 7. Запуск фонового процесса screenShotik
    pkill -u "$TARGET_USER" -f "screenshotik" 2>/dev/null || true
    su - "$TARGET_USER" -c "nohup ${bin_path} --hidden >/dev/null 2>&1 &" || true

    log_success "screenShotik установлен и запущен."
}

setup_hotkeys() {
    log_info "Регистрация горячих клавиш в окружении пользователя..."

    # Hyprland / Omarchy (bindings.lua)
    local omarchy_bindings="${TARGET_HOME}/.config/hypr/bindings.lua"
    if [[ -f "$omarchy_bindings" ]]; then
        if ! grep -q "screenShotik" "$omarchy_bindings"; then
            cat << 'EOF' >> "$omarchy_bindings"

-- Megagroup screenShotik shortcuts
hl.unbind("SUPER + SHIFT + PRINT")
o.bind("SUPER + SHIFT + PRINT", "screenShotik screenshot", "screenshotik")
hl.unbind("SHIFT + F1")
o.bind("SHIFT + F1", "screenShotik Shift+F1", "screenshotik --capture")
hl.unbind("PRINT")
o.bind("PRINT", "screenShotik Print", "screenshotik --capture")
hl.unbind("CTRL + PRINT")
o.bind("CTRL + PRINT", "screenShotik Ctrl+Print", "screenshotik")
EOF
            log_success "Горячие клавиши Shift+F1 и Print добавлены в bindings.lua"
            su - "$TARGET_USER" -c "hyprctl reload 2>/dev/null || true" || true
        else
            log_info "Горячие клавиши уже присутствуют в bindings.lua"
        fi
    fi

    # Стандартный Hyprland (hyprland.conf)
    local hypr_conf="${TARGET_HOME}/.config/hypr/hyprland.conf"
    if [[ -f "$hypr_conf" && ! -f "$omarchy_bindings" ]]; then
        if ! grep -q "screenshotik" "$hypr_conf"; then
            cat << 'EOF' >> "$hypr_conf"

# Megagroup screenShotik shortcuts
bind = SHIFT, F1, exec, screenshotik --capture
bind = , Print, exec, screenshotik --capture
bind = CTRL, Print, exec, screenshotik
bind = SUPER SHIFT, Print, exec, screenshotik
EOF
            su - "$TARGET_USER" -c "hyprctl reload 2>/dev/null || true" || true
        fi
    fi

    # Sway (~/.config/sway/config)
    local sway_conf="${TARGET_HOME}/.config/sway/config"
    if [[ -f "$sway_conf" ]] && ! grep -q "screenshotik" "$sway_conf"; then
        cat << 'EOF' >> "$sway_conf"

# Megagroup screenShotik shortcuts
bindsym Shift+F1 exec screenshotik --capture
bindsym Print exec screenshotik --capture
EOF
    fi
}

main() {
    install_packages

    if [[ "$SKIP_VPN" == false ]]; then
        setup_openvpn
    fi

    if [[ "$SKIP_SHOTIK" == false ]]; then
        setup_screenshotik
    fi

    echo
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}      Установка Megagroup Linux успешно завершена!          ${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo

    # Запуск диагностики
    if [[ -x "${SCRIPT_DIR}/scripts/verify.sh" ]]; then
        su - "$TARGET_USER" -c "${SCRIPT_DIR}/scripts/verify.sh" || true
    fi

    echo
    echo -e "Проверка работы screenShotik:"
    echo -e "  - Горячая клавиша: ${BOLD}Shift + F1${NC} или ${BOLD}Print${NC} (выделение области + стрелки/рамки + ссылка)"
    echo -e "  - Из консоли:      ${BOLD}screenshotik --capture${NC}"
    echo
    echo -e "Управление OpenVPN Megagroup:"
    echo -e "  - Меню сети:       ${BOLD}Super + Ctrl + W${NC} -> megagroup"
    echo -e "  - В консоли:       ${BOLD}megagroup-vpn up${NC} / ${BOLD}megagroup-vpn down${NC}"
    echo -e "  - Через nmcli:     ${BOLD}nmcli connection up megagroup${NC}"
    echo
}

main
