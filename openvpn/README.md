# Megagroup OpenVPN for Linux

Конфигурация корпоративного OpenVPN Megagroup для Linux (Omarchy / Arch, Ubuntu / Debian, Fedora, openSUSE).

## Параметры
- **Шлюз**: `gnome2.megagroup.ru:443 udp`
- **Шифрование**: BF-CBC (поддержка `data-ciphers DEFAULT:BF-CBC` для OpenVPN 2.5/2.6/2.7)
- **Маршрутизация**: DNS через `systemd-resolved`
- **Логин**: `server.asanov.4518` (или личная учетная запись)

## Быстрое управление
- **Через виджет панели сети** (Omarchy / Hyprland): `Super + Ctrl + W` -> клик на `megagroup`.
- **Через терминал**:
  ```bash
  megagroup-vpn up       # подключить
  megagroup-vpn down     # отключить
  megagroup-vpn status   # статус
  megagroup-vpn toggle   # переключить
  ```
- **Через nmcli**:
  ```bash
  nmcli connection up megagroup
  nmcli connection down megagroup
  ```
- **Через systemd** (без NetworkManager):
  ```bash
  sudo systemctl start openvpn-client@megagroup
  sudo systemctl enable openvpn-client@megagroup
  ```
