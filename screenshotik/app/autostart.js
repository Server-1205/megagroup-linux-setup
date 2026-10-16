'use strict';

// Автозапуск на Linux через XDG autostart (.desktop), как делает
// auto-launch-patched, но без зависимости.

const fs = require('fs');
const os = require('os');
const path = require('path');

const desktopFile = () => path.join(os.homedir(), '.config', 'autostart', 'screenShotik.desktop');

const execLine = () => {
    const {app} = require('electron');
    if (process.env.APPIMAGE) {
        return `"${process.env.APPIMAGE}" --hidden`;
    }
    if (app.isPackaged) {
        return `"${process.execPath}" --hidden`;
    }
    return `"${process.execPath}" "${path.join(app.getAppPath(), 'app', 'main.js')}"`;
};

const content = () => `[Desktop Entry]
Type=Application
Name=screenShotik
Comment=Screenshot app
Exec=${execLine()}
Icon=screenShotik
Terminal=false
X-GNOME-Autostart-enabled=true
`;

const enableAutostart = () => {
    const file = desktopFile();
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, content());
    return file;
};

const disableAutostart = () => {
    const file = desktopFile();
    try {
        fs.unlinkSync(file);
    } catch (e) {
        /* уже удалён */
    }
};

const isAutostartEnabled = () => fs.existsSync(desktopFile());

module.exports = {
    enableAutostart,
    disableAutostart,
    isAutostartEnabled
};