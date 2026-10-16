# Megagroup Linux Setup

Универсальный пакет и скил для автоматического развертывания рабочего окружения **Megagroup** на любом дистрибутиве Linux в **1 клик**:
- **OpenVPN**: корпоративный VPN (`gnome2.megagroup.ru:443 udp`, шифрование BF-CBC, интеграция с NetworkManager без запроса паролей, systemd unit, виджет панели сети).
- **screenShotik**: нативный Linux-клиент создания скриншотов Megagroup (точная копия Windows-версии: аннотации, стрелки, рамки, корпоративный цвет `#BC0000`, мгновенная загрузка на `https://o525.ru/upload`, автокопирование ссылки в буфер обмена `wl-copy`/X11, горячие клавиши `Shift + F1` и `Print`).

Совместимость: **Omarchy Linux** (Arch/Hyprland), **Arch Linux**, **Ubuntu / Debian / Mint**, **Fedora / RHEL**, **openSUSE**.

---

##  Быстрый старт (в 1 клик)

### Вариант 1. Клонирование из GitHub
```bash
git clone https://github.com/ВАШ_ЛОГИН/megagroup-linux-setup.git
cd megagroup-linux-setup
sudo ./install.sh
```

### Вариант 2. Тихая установка (без вопросов)
```bash
sudo ./install.sh --unattended
```

### Вариант 3. Выборочная установка
```bash
sudo ./install.sh --vpn-only      # Только OpenVPN
sudo ./install.sh --shotik-only   # Только screenShotik
```

---

## 📸 Использование screenShotik

| Действие | Горячая клавиша / Команда | Описание |
| :--- | :--- | :--- |
| **Выделение области + аннотации** | **`Shift + F1`** или **`Print`** | Открывает оверлей для выделения, рисования стрелок, текста и рамок |
| **Сохранить на сервере** | **`Ctrl + Enter`** (в оверлее) | Загружает на `o525.ru`, копирует короткую ссылку в буфер и закрывает оверлей |
| **Копировать в буфер** | **`Enter`** (в оверлее) | Копирует PNG-изображение снимка в буфер обмена |
| **Сохранить на диск** | **`Shift + Ctrl + Enter`** | Сохраняет файл в `~/Pictures/Screenshots` |
| **Снимок всего экрана** | **`Ctrl + Print`** | Захват полного рабочего стола |
| **Запуск из консоли** | `screenshotik --capture` | Вызов окна захвата из любого терминала или скрипта |

---

## 🔒 Управление OpenVPN Megagroup

1. **В графическом интерфейсе (Omarchy / Hyprland)**:
   - Нажмите **`Super + Ctrl + W`** (или кликните по иконке сети на верхней панели).
   - В списке соединений нажмите переключатель **`megagroup`**.
   - Пароль сохранён в системе, подключение происходит мгновенно без всплывающих окон.

2. **Через консольную утилиту `megagroup-vpn`**:
   ```bash
   megagroup-vpn up       # Подключиться
   megagroup-vpn down     # Отключиться
   megagroup-vpn status   # Проверить статус
   megagroup-vpn toggle   # Переключить состояние
   ```

3. **Через стандартный NetworkManager**:
   ```bash
   nmcli connection up megagroup
   nmcli connection down megagroup
   ```

4. **Через Headless systemd** (для серверов без GUI):
   ```bash
   sudo systemctl start openvpn-client@megagroup
   sudo systemctl enable openvpn-client@megagroup
   ```

---

## 🩺 Диагностика и проверка

Для проверки работоспособности всех узлов запустите встроенный скрипт:
```bash
./scripts/verify.sh
```

Вывод при корректной работе:
```text
=== Megagroup Linux Setup: Diagnostic Check ===

1. OpenVPN (NetworkManager)... CONNECTED (Active)
2. Corporate Network (staff.megagroup.ru)... REACHABLE
3. screenShotik Daemon... RUNNING (PID: 2000625)
4. screenShotik Authorization... AUTHENTICATED (JWT Active)
5. Hotkeys (Hyprland / Omarchy)... ACTIVE (Shift+F1 / Print bound)

 Все ключевые компоненты работают штатно!
```

---

## 🤖 AI Agent Skill (`SKILL.md`)

Репозиторий включает готовый скил для автономных AI-ассистентов (Codex, Claude, Omp, Pi).
При переносе на новый ПК ассистент автоматически понимает архитектуру проекта и может развернуть или починить окружение по команде:
> *"Разверни Megagroup на этом ПК"*

---

## 🗑 Удаление

Если потребуется полностью удалить все компоненты:
```bash
sudo ./uninstall.sh
```
Скрипт корректно остановит демоны, удалит VPN-профиль, файлы screenShotik и очистит бинды в `bindings.lua`.
