---
name: megagroup-setup
description: >
  REQUIRED for deploying, configuring, or troubleshooting the Megagroup corporate
  workspace on Linux (Omarchy / Arch, Debian / Ubuntu, Fedora, openSUSE).
  Handles 1-click deployment of OpenVPN (gnome2.megagroup.ru, NetworkManager, systemd)
  and the native screenShotik client (Electron Wayland/Hyprland capture, annotations,
  instant upload to o525.ru, clipboard link copying, and hotkeys).
metadata:
  short-description: Deploy and manage Megagroup OpenVPN & screenShotik
---

# Megagroup Setup Skill

Deploy, configure, and maintain the **Megagroup corporate workspace** on Linux systems in 1 click.

## When This Skill MUST Be Used

**Invoke this skill for ANY of the following tasks:**
- Installing or restoring the Megagroup workspace on a new Linux machine (Omarchy, Arch, Ubuntu, Debian, Fedora, openSUSE).
- Setting up or troubleshooting the corporate OpenVPN connection (`gnome2.megagroup.ru`).
- Installing, configuring, or fixing the native Linux client **screenShotik** (shortcuts, Wayland capture, upload to `o525.ru`, annotations, clipboard).
- Automating single-command provisioning for Megagroup employees.

---

## Architecture & Components

```
                    +---------------------------+
                    |   Megagroup Linux Setup   |
                    +-------------+-------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
         v                                                 v
+-------------------------------+               +-----------------------------------+
|      OpenVPN Corporate        |               |            screenShotik           |
|-------------------------------|               |-----------------------------------|
| - Gateway: gnome2.megagroup.ru|               | - Native Electron Linux port      |
| - Port/Proto: 443 UDP         |               | - Palette: #BC0000 corporate red  |
| - Cipher: BF-CBC (legacy)     |               | - Backend: https://o525.ru/upload |
| - Auth: server.asanov.4518    |               | - Wayland clipboard: wl-copy      |
| - DNS: systemd-resolved       |               | - Hotkeys: Shift+F1 / Print       |
| - NM: 1-click panel widget    |               | - Autostart: ~/.config/autostart  |
+-------------------------------+               +-----------------------------------+
```

---

## 1-Click Deployment

### Quick Command (Local or Remote)

From the project directory:
```bash
sudo ./install.sh
```

Or unattended mode:
```bash
sudo ./install.sh --unattended
```

### What `install.sh` Does Automatically:
1. **Detects Distro**: Automatically uses `pacman`, `apt`, `dnf`, or `zypper`.
2. **Installs System Dependencies**: `openvpn`, `networkmanager-openvpn`, `libnotify`, `grim`, `slurp`, `wl-clipboard`, `xclip`.
3. **Configures OpenVPN**:
   - Deploys `/etc/openvpn/client/megagroup.conf` with legacy `data-ciphers DEFAULT:BF-CBC`.
   - Saves credentials in `/etc/openvpn/client/megagroup.auth` (mode `600`).
   - Imports profile into NetworkManager with pre-saved password (`password-flags=0`) so connecting requires 0 password prompts.
   - Installs helper CLI `/usr/local/bin/megagroup-vpn` and desktop entry.
4. **Configures screenShotik**:
   - Installs app files and pre-built `resources/app.asar` (with all base64 icons, direct XHR upload, and IPC clipboard).
   - Installs launcher `/usr/local/bin/screenshotik` with `--no-sandbox --no-zygote`.
   - Sets user configuration `~/.config/screenShotik/shotik.json` with active JWT token.
   - Configures desktop shortcut and autostart (`~/.config/autostart/screenShotik.desktop`).
   - Binds global hotkeys in Omarchy (`~/.config/hypr/bindings.lua`) or standard Hyprland (`hyprland.conf`) for `Shift + F1` and `Print`.
   - Starts screenShotik in the background.
5. **Runs Self-Diagnostics**: Executes `scripts/verify.sh` to confirm all 5 checkpoints.

---

## Daily Usage & Operations

### OpenVPN
- **Omarchy / Hyprland GUI**: Press `Super + Ctrl + W` -> click `megagroup`.
- **Terminal CLI**:
  ```bash
  megagroup-vpn up       # Connect
  megagroup-vpn down     # Disconnect
  megagroup-vpn status   # Status
  megagroup-vpn toggle   # Switch state
  ```
- **nmcli directly**:
  ```bash
  nmcli connection up megagroup
  nmcli connection down megagroup
  ```

### screenShotik
- **Hotkeys**:
  - `Shift + F1` or `Print` -> interactive overlay: select region, draw arrows/frames/numbers, click Save.
  - `Ctrl + Enter` in overlay -> saves directly to server and copies short link to clipboard.
- **Terminal trigger**:
  ```bash
  screenshotik --capture
  ```

---

## Verification & Diagnostics

Run the bundled diagnostic script:
```bash
./scripts/verify.sh
```

Checkpoints:
1. `OpenVPN`: NetworkManager connection status.
2. `Corporate Gateway`: HTTP connectivity to `https://staff.megagroup.ru`.
3. `screenShotik`: Background process check (`pgrep -f screenshotik`).
4. `JWT Token`: Presence and validity in `~/.config/screenShotik/shotik.json`.
5. `Hotkeys`: Presence of bindings in `hyprctl binds`.
