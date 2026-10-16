'use strict';

const {app, globalShortcut, BrowserWindow, ipcMain, Menu, Tray, MenuItem, dialog, shell, Notification, screen} = require('electron');
const electron = require('electron');
const platform = require('os').platform();
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;
const captureTimeout = Number(process.env.SHOTIK_CAPTURE_TIMEOUT || 8000);

// main.js выполняется до app.ready, поэтому путь и имя файла настроек
// нужно раздать заранее: процессы рендереров наследуют env и читают их в ./conf
process.env.SHOTIK_USER_DATA = app.getPath('userData');
process.env.SHOTIK_CONF_NAME = isDev ? "dev-shotik" : "shotik";

const StopWatch = require('./stopwatch');
const {createStore} = require('./conf');
const runtime = require('./runtime');
const logger = require('./log');
const {enableAutostart, disableAutostart, isAutostartEnabled} = require('./autostart');

const devBackend = "http://shotik.loc:8080";
const prodBackend = "https://o525.ru";

let authenticated = false;
let quitRequested = false;
let updateCheckOnStartUp;
let mainWindowReadyToShow;
let screenTmpFile = null;
let changeLog = null;
let history = null;
let tray = null;
let mainWindow = null;
let mainWindowDisplay = null;
// ссылка на makeScreenShot для обработчика second-instance (объявлена ниже, внутри блока)
let triggerCapture = null;

let getDevConf = () => createStore("dev-shotik");
let getProdConf = () => createStore("shotik");

let resetAuthorization = () => {
    global.conf.set("token", null);
    global.conf.set("authenticated", null);
    authenticated = false;
};

if (isDev) {
    logger.info('Running in development');
    global.conf = getDevConf();
    global.conf.set('backend', devBackend);
    global.conf.set('dbname', 'dev.db');
} else {
    logger.info('Running in production');
    global.conf = getProdConf();
    global.conf.set('backend', prodBackend);
    global.conf.set('dbname', 'prod.db');
}

if (global.conf.get('logging')) {
    logger.transports.file.level = "info";
    logger.transports.console.level = "info";
    process.env.SHOTIK_LOG_LEVEL = "info";
} else {
    logger.transports.file.level = "warn";
    logger.transports.console.level = "warn";
    process.env.SHOTIK_LOG_LEVEL = "warn";
}

authenticated = global.conf.get("authenticated");
if (!global.conf.get('saveDir')) {
    global.conf.set('saveDir', app.getPath('pictures'))
}

if (!global.conf.get('version')) {
    global.conf.set('autostart', true);
    global.conf.set('silentUpdate', true);
}

if (!global.conf.has('dedicatedCapturer')) {
    global.conf.set('dedicatedCapturer', true);
}

if (!global.conf.has('cancelOnBlur')) {
    global.conf.set('cancelOnBlur', true);
}

// Как в оригинале: без авторизации на backend снять скриншот нельзя.
// Флаг allowLocalWithoutAuth оставлен на случай, если backend недоступен —
// тогда приложение работает локально (буфер, файлы, история).
if (!global.conf.has('allowLocalWithoutAuth')) {
    global.conf.set('allowLocalWithoutAuth', false);
}

if (platform === 'linux') {
    app.setAppUserModelId("megagroup.shotik.app.id");
    // Приложение рисует только 2D-канвас поверх снимка экрана, поэтому
    // аппаратное ускорение ему не нужно, а software-рендеринг не падает
    // там, где нет доступа к DRM-карте (MESA/gbm). Включается через SHOTIK_GPU=1
    if (process.env.SHOTIK_GPU !== '1') {
        app.disableHardwareAcceleration();
    }
    // Родной wayland-бэкенд: с ним Hyprland корректно отдаёт фокус и
    // полноэкранный режим оверлея (на XWayland _NET_WM_STATE_* игнорируется).
    // Переопределяется переменной SHOTIK_OZONE=x11.
    const ozone = process.env.SHOTIK_OZONE ||
        (process.env.XDG_SESSION_TYPE === 'wayland' ? 'wayland' : 'x11');
    app.commandLine.appendSwitch('ozone-platform', ozone);
    if (ozone === 'wayland') {
        app.commandLine.appendSwitch('disable-vulkan');
    }
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
}

// Ошибки и логи рендереров — в общий лог приложения
const watchRenderer = (win, name) => {
    if (!win || !win.webContents) return;
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (String(message).indexOf('Electron Security Warning') !== -1) {
            return;
        }
        const text = '[' + name + '] ' + message + ' (' + String(sourceId || '').split('/').pop() + ':' + line + ')';
        if (level >= 2) {
            logger.error(text);
        } else {
            logger.info(text);
        }
    });
    win.webContents.on('render-process-gone', (event, details) => {
        logger.error('renderer ' + name + ' упал: ' + JSON.stringify(details));
    });
};

// Окна приложения грузят локальные html-файлы, которым нужен require()
const localWindowsPrefs = () => ({
    nodeIntegration: true,
    contextIsolation: false,
    webSecurity: false,
    // иначе скрытое окно не рисует кадр и ready-to-show может не прийти
    paintWhenInitiallyHidden: true
});

const cliArgs = process.argv.slice(app.isPackaged ? 1 : 2);
const isCaptureArg = (argv) => Array.isArray(argv) && argv.some((a) => a === '--capture' || a === '-c' || a === 'capture');
const isVersionArg = (argv) => Array.isArray(argv) && argv.some((a) => a === '--version' || a === '-v' || a === 'version');
const isHelpArg = (argv) => Array.isArray(argv) && argv.some((a) => a === '--help' || a === '-h' || a === 'help');

if (isVersionArg(process.argv) || isVersionArg(cliArgs)) {
    const pkg = require('../package.json');
    console.log(pkg.version || app.getVersion());
    process.exit(0);
}

if (isHelpArg(process.argv) || isHelpArg(cliArgs)) {
    const pkg = require('../package.json');
    const version = pkg.version || app.getVersion();
    console.log(`screenShotik v${version}
Использование:
  screenshotik            Запуск приложения (сворачивается в трей)
  screenshotik --capture  Сделать снимок экрана
  screenshotik --version  Показать версию
  screenshotik --help     Показать эту справку`);
    process.exit(0);
}

let captureRequestedByCli = isCaptureArg(cliArgs);
// Только одно приложение может быть запущено в один момент.
// Второй экземпляр (например, из бинда Hyprland) просто передаёт запрос
// уже запущенному через requestSingleInstanceLock.
const gotLock = app.requestSingleInstanceLock();
app.on('second-instance', (event, argv) => {
    if (isCaptureArg(argv) && triggerCapture) {
        setTimeout(() => triggerCapture(), 300);
    }
});
if (!gotLock) {
    app.quit();
} else {

    logger.info(logger.transports.file.findLogPath());
    let autoUpdater = null;
    let updateStatusWindow;

    const defaultMenu = require("./menu");

    logger.info(defaultMenu);

    let authWindow = null;
    let loginCallback = null;
    let loginWindow = null;
    let loginAttempts = 0;
    let authWindowLoaded = false;
    let serverError = false;
    let onBasicAuthLogin = (event, webContents, request, authInfo, callback) => {
        event.preventDefault();
        logger.info(authInfo);
        runtime.authInfo = authInfo;
        if (authInfo.scheme === 'basic') {
            if (!loginWindow) {
                logger.info("new login window created");
                loginWindow = new BrowserWindow(
                    {
                        center: true,
                        show: false,
                        width: 500,
                        height: 400,
                        webPreferences: localWindowsPrefs()
                    }
                );
                loginWindow.loadURL(`file://${__dirname}/login.html`);
                loginWindow.on('close', (event) => {
                    if (!authenticated && !authWindowLoaded && !serverError && !quitRequested) {
                        event.preventDefault();
                        loginWindow.hide();
                        authWindow.close();
                    } else {
                        loginWindow = null;
                    }
                });
                loginWindow.once('ready-to-show', () => {
                    loginWindow.show()
                });
            } else {
                if (!loginWindow.isFocused()) {
                    loginWindow.focus();
                }
                loginWindow.webContents.send("login-error", {});
            }

            loginCallback = callback;
            loginAttempts++;
        } else {
            quitRequested = true;
            app.quit();
        }
    };
    app.on('login', onBasicAuthLogin);
    let doAuthenticate = () => {
        if (!authenticated) {
            if (authWindow) {
                if (loginWindow) {
                    loginWindow.show();
                    loginWindow.focus();
                } else {
                    authWindow.focus();
                }
            } else {
                logger.info("new auth window created");
                authWindowLoaded = false;
                authWindow = new BrowserWindow(
                    {
                        center: true,
                        show: false,
                        webPreferences: localWindowsPrefs()
                    });
                authWindow.setMenu(null);

                authWindow.once('ready-to-show', () => {
                    authWindowLoaded = true;
                    if (loginWindow) {
                        loginWindow.close();
                    }
                    logger.info('auth window ready-to-show');
                    authWindow.show();
                });
                authWindow.webContents.on('did-finish-load', () => {
                    logger.info('auth window loaded: ' + authWindow.webContents.getURL());
                });
                // Если ready-to-show так и не придёт (редиректы, медленный SSO) —
                // показываем окно в любом случае, иначе логин недоступен
                setTimeout(() => {
                    if (authWindow && !authWindow.isDestroyed() && !quitRequested && !authenticated) {
                        authWindowLoaded = true;
                        logger.info('auth window shown by timeout');
                        authWindow.show();
                    }
                }, 4000);
                authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
                    serverError = true;
                    if (!quitRequested) {
                        dialog.showMessageBox({
                                type: "question",
                                message: "Ошибка или недоступность ресурса \n[" + errorDescription + "]\n" + validatedURL,
                                buttons: ["Закрыть приложение"]
                            })
                            .then(({response}) => {
                                logger.info("response: " + response);
                                setImmediate(() => {
                                    if (response === 0) {
                                        quitRequested = true;
                                        app.quit();
                                    }
                                });
                            });
                    }
                    serverError = false;
                });
                authWindow.loadURL(global.conf.get('backend') + "/authenticate");
                authWindow.on('close', (event) => {
                    if (!authenticated && !authWindowLoaded && !serverError && !quitRequested) {
                        event.preventDefault();
                        authWindow.hide();
                    } else {
                        authWindow = null;
                    }
                });
            }
        }
    };

    let contextMenu = null;
    let shown = false;
    let pwd;
    const {capture} = require('./capture');
    const {pathToFileURL} = require('url');

    let doDedicatedCapture = async (display) => {
        screenTmpFile = null;
        try {
            const saveDir = global.conf.get('saveDir') || require('os').tmpdir();
            const file = await capture(display, saveDir);
            const fileUrl = pathToFileURL(file).href;
            if (mainWindowReadyToShow && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('screen-from-file', {
                    file: fileUrl,
                    display: display,
                    cursor: screen.getCursorScreenPoint()
                });
            } else {
                screenTmpFile = fileUrl;
            }
        } catch (e) {
            logger.error('Capture error:', e);
            throw e;
        }
    };

    let mainWindowOnShow = () => {
        logger.info("main-window-onshow");
        if (!shown) {
            mainWindow.webContents.send('shown', {one: true});
            logger.info(StopWatch.end('screen').toStringSeconds());
        } else {
            if (history && !history.isDestroyed()) {
                history.hide();
            }
            if (changeLog && !changeLog.isDestroyed()) {
                changeLog.hide();
            }
        }
        shown = true;
    };

    ipcMain.on('got-access-token', (event, arg) => {
        if (arg && arg.token) {
            global.conf.set("token", arg.token);
            global.conf.set("authenticated", true);
            authenticated = true;
            if (authWindow && authWindow.isClosable()) {
                authWindow.close();
            }
            if (loginWindow && loginWindow.isClosable()) {
                loginWindow.close();
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.focus();
            }
            logger.info("got token", arg);
        }

    });

    ipcMain.on('show-error-box', (event, arg) => {
        dialog.showErrorBox(arg.title, String(arg.message));
    });


    ipcMain.on('notification', (event, arg) => {
        let n = new Notification({
            title: arg.title,
            body: arg.body
        });
        let fileName;
        let url;
        if (arg.file) {
            fileName = arg.file
        }

        if (arg.url) {
            url = arg.url
        }
        n.on("click", () => {
            if (fileName) {
                shell.showItemInFolder(fileName);
            } else if (url) {
                shell.openExternal(url);
            }
        }
        );
        n.show();
    });

    // Оверлей должен быть на весь экран. setKiosk() до show() часть
    // композиторов (в том числе Hyprland) игнорирует, поэтому сначала
    // показываем окно, потом включаем kiosk/fullscreen и страхуемся
    // точными границами дисплея.
    const showOverlay = () => {
        const win = mainWindow;
        const bounds = mainWindowDisplay ? mainWindowDisplay.bounds :
            screen.getPrimaryDisplay().bounds;
        win.show();
        // Размер окна применится только после show(), порядок именно такой
        setTimeout(() => {
            if (win.isDestroyed()) return;
            win.setAlwaysOnTop(true, 'screen-saver');
            win.setBounds(bounds);
            win.setFullScreen(true);
            win.focus();
            setTimeout(() => {
                if (win.isDestroyed()) return;
                if (!win.isFullScreen()) {
                    win.setBounds(bounds);
                }
                logger.info('overlay window state: ' + JSON.stringify({
                    visible: win.isVisible(),
                    focused: win.isFocused(),
                    fullScreen: win.isFullScreen(),
                    alwaysOnTop: win.isAlwaysOnTop(),
                    bounds: win.getBounds()
                }));
                // Если фокус композитор не отдал, оверлей всё равно должен
                // начать работу: mainWindowOnShow включает режим выделения.
                if (win.isVisible() && !shown) {
                    mainWindowOnShow();
                }
            }, 400);
        }, 250);
    };

    ipcMain.on('screenshot-done', (event, arg) => {
        logger.info('screen-shot-done');
        if (mainWindow !== null) {
            logger.info('showing browser window');
            showOverlay();
        }
    });

    ipcMain.on('login-form-submitted', (event, arg) => {
        logger.info('login-form-submitted');
        if (loginCallback) {
            pwd = arg.pwd;
            loginCallback(arg.login, arg.pwd);
            loginCallback = null;
        }
    });

    ipcMain.on('close-main-window', (event, arg) => {
        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            mainWindow.close();
        }
        mainWindow = null;
        checkForUpdates(10000);
        if (platform === 'darwin') {
            app.hide();
        }
    });

    ipcMain.on('history-updated', () => {
        logger.info('history-updated');
        if (history && !history.isDestroyed()) {
            logger.info('history-updated passing');
            history.webContents.send('history-updated', {});
        }

    });

    ipcMain.on('destroy-main-window', (event, arg) => {
        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            mainWindow.close();
        }
        mainWindow = null;
        checkForUpdates(10000);
        if (platform === 'darwin') {
            app.hide();
        }
    });


    ipcMain.on('app-quit', (event, arg) => {
        quitRequested = true;
        app.quit();
    });

    ipcMain.on('do-authenticate', () => {
        doAuthenticate();
    });


    ipcMain.on('authorization-not-valid', () => {
        resetAuthorization();
        doAuthenticate();
    });

    ipcMain.on('writeTextToClipboard', (event, text) => {
        electron.clipboard.writeText(text);
        if (platform === 'linux') {
            const {spawn} = require('child_process');
            try {
                const p = spawn('wl-copy');
                p.stdin.write(text);
                p.stdin.end();
            } catch (e) {}
        }
    });

    ipcMain.on('saveDataURLToClipboard', (event, dataURL) => {
        let image = electron.nativeImage.createFromDataURL(dataURL);
        electron.clipboard.writeImage(image, 'png');
        if (platform === 'linux') {
            const {spawn} = require('child_process');
            try {
                const pngBuf = image.toPNG();
                const p = spawn('wl-copy', ['--type', 'image/png']);
                p.stdin.write(pngBuf);
                p.stdin.end();
            } catch (e) {}
        }
    });

    ipcMain.on('open-external', (event, url) => {
        if (url) {
            shell.openExternal(url);
        }
    });

    function createWindow(display, callback) {
        // Геометрию не задаём в конструкторе: композитор (Hyprland в том числе)
        // переписывает размер окна при первой карте, а наш setBounds()
        // после show() применяется корректно.
        mainWindowReadyToShow = false;
        mainWindowDisplay = display;
        mainWindow = new BrowserWindow(
            {
                show: false,
                autoHideMenuBar: true,
                webPreferences: localWindowsPrefs()
            });
        mainWindow.setMenu(null);
        watchRenderer(mainWindow, 'overlay');

        mainWindow.loadURL(`file://${__dirname}/index.html`)

        mainWindow.on('ready-to-show', () => {
            mainWindowReadyToShow = true;
            if (callback) callback();
        });
        // Emitted when the window is closed.
        // Emitted when the window is closed.
        mainWindow.on('closed', () => {
            logger.info('closed');
            mainWindow = null;
        });

        mainWindow.on('show', function () {
            mainWindowReadyToShow = true;
        });
        shown = false;
        mainWindow.on('focus', mainWindowOnShow);
        mainWindow.on('blur', () => logger.info('overlay blur'));
        mainWindow.on('hide', () => logger.info('overlay hide'));
        mainWindow.on('show', () => logger.info('overlay show'));
    }

    let makeScreenShot = () => {
        if (authenticated || global.conf.get('allowLocalWithoutAuth')) {
            if (mainWindow && mainWindow.isDestroyed()) {
                mainWindow = null;
            }
            if (mainWindow === null) {
                let display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
                logger.info(JSON.stringify(screen.getAllDisplays()));
                logger.info(JSON.stringify(display));
                let dedicated = global.conf.get('dedicatedCapturer');
                let onReady = () => {
                    if (!dedicated) {
                        mainWindow.webContents.send('shoot-screen', Object.assign({}, display, {
                            cursor: screen.getCursorScreenPoint()
                        }));
                    } else {
                        if (screenTmpFile) {
                            let _ = screenTmpFile;
                            mainWindow.webContents.send('screen-from-file', {
                                file: _,
                                display: display,
                                cursor: screen.getCursorScreenPoint()
                            });
                            screenTmpFile = null;
                        }
                    }
                };
                const startCapture = dedicated ? doDedicatedCapture(display) : Promise.resolve();
                startCapture
                    .then(() => {
                        createWindow(display, onReady);
                    })
                    .catch((err) => {
                        logger.error(err);
                        StopWatch.end('screen');
                        dialog.showErrorBox('Не удалось сделать снимок экрана', String(err.message || err));
                    });
            } else {
                if (!global.conf.get('cancelOnBlur') && mainWindow && !mainWindow.isDestroyed()) {
                    if (!mainWindow.isVisible()) {
                        mainWindow.show();
                    }
                    if (!mainWindow.isFocused()) {
                        mainWindow.focus();
                    }
                }
                logger.info('Already editing screenshot');
            }
            logger.info('Making ScreenShot');
        } else {
            logger.info('Not authenticated');
            doAuthenticate();
        }
    };
    runtime.makeScreenShot = makeScreenShot;
    triggerCapture = makeScreenShot;

    let showChangeLog = () => {
        if (!changeLog || changeLog.isDestroyed()) {
            changeLog = new BrowserWindow({
                    center: true,
                    show: false,
                    width: 300,
                    height: 600,
                    webPreferences: localWindowsPrefs()
                }
            );
            changeLog.loadURL(`file://${__dirname}/change.log.html#${app.getVersion()}`);
            changeLog.show();
        } else {
            changeLog.show();
            changeLog.focus();
        }
    };

    let showHistory = () => {
        if (!history || history.isDestroyed()) {
            history = new BrowserWindow({
                    center: true,
                    show: false,
                    width: 600,
                    height: 800,
                    webPreferences: localWindowsPrefs()
                }
            );
            history.loadURL(`file://${__dirname}/history.html`);
            history.show();
        } else {
            history.show();
            history.focus();
        }
    };


    ipcMain.on('close-history', (event, arg) => {
        if (history && !history.isDestroyed()) {
            history.close();
            if (platform === 'darwin') {
                app.hide();
            }
        }
    });

    ipcMain.on('close-changelog', (event, arg) => {
        if (changeLog && !changeLog.isDestroyed()) {
            changeLog.close();
            if (platform === 'darwin') {
                app.hide();
            }
        }
    });

    // Автообновление на Linux не делаем: дистрибутив лежит на сервере
    // приложения и содержит только windows-сборки. Вместо этого по клику
    // открывается страница загрузки (настраивается в конфиге).
    let updateUrl = () => global.conf.get('updateUrl');

    ipcMain.on('check-for-updates', (event, arg) => {
        if (updateUrl()) {
            shell.openExternal(updateUrl());
        }
    });

    let checkForUpdates = () => {
        // no-op
    };

    app.on('ready', () => {
        let hotKeys = require("./hotkeys")(platform);

        if (captureRequestedByCli) {
            captureRequestedByCli = false;
            setTimeout(() => makeScreenShot(), 500);
        }

        if (!global.conf.get('version') || global.conf.get('version') !== app.getVersion()) {
            if (app.getVersion() === '0.2.0') {
                global.conf.set('silentUpdate', true);
            }
            if (app.getVersion() === '0.2.2') {
                for (let i in hotKeys.default) {
                    global.conf.set(hotKeys.getSettingName(hotKeys.default[i]), true);
                }
            }
            showChangeLog();
            global.conf.set('version', app.getVersion());
        }


        let trayImage = '';
        let imageFolder = `${__dirname}/icon/icons/tray`;

        if (platform === 'darwin') {
            trayImage = imageFolder + '/mac/iconTemplate.png';
        } else if (platform === 'win32') {
            trayImage = imageFolder + '/win/icon.png';
        } else {
            trayImage = imageFolder + '/linux/icon.png';
            if (!fs.existsSync(trayImage)) {
                trayImage = imageFolder + '/linux/icon@2x.png';
            }
        }

        let keysMenu = [];
        for (let i in hotKeys.all) {
            if (global.conf.get(hotKeys.getSettingName(hotKeys.all[i]))) {
                globalShortcut.register(hotKeys.all[i], makeScreenShot);
            }
            keysMenu.push({
                label: hotKeys.all[i],
                accelerator: (platform === 'win32' ? '' : hotKeys.all[i]),
                checked: !!global.conf.get(hotKeys.getSettingName(hotKeys.all[i])),
                type: "checkbox",
                click: (item) => {
                    if (item.checked) {
                        global.conf.set(hotKeys.getSettingName(hotKeys.all[i]), true);
                        globalShortcut.register(hotKeys.all[i], makeScreenShot);
                    } else {
                        global.conf.set(hotKeys.getSettingName(hotKeys.all[i]), false);
                        globalShortcut.unregister(hotKeys.all[i]);
                    }
                }
            });
        }

        tray = new Tray(trayImage);
        contextMenu = Menu.buildFromTemplate([
            {
                label: 'Скриншот',
                click: () => {
                    makeScreenShot();
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Открывать скриншот в браузере',
                type: 'checkbox',
                checked: global.conf.get('openInBrowser'),
                click: (item) => {
                    global.conf.set('openInBrowser', item.checked);
                }
            },
            {
                label: "Короткие клавиши",
                submenu: keysMenu

            },
            {
                label: 'Отменять скриншот при потере фокуса',
                type: 'checkbox',
                checked: global.conf.get('cancelOnBlur'),
                click: (item) => {
                    global.conf.set('cancelOnBlur', item.checked);
                }
            },
            {
                label: 'Включить дебаг лог',
                type: 'checkbox',
                checked: global.conf.get('logging'),
                click: (item) => {
                    global.conf.set('logging', item.checked);
                    logger.transports.file.level = item.checked ? "info" : "warn";
                    logger.transports.console.level = item.checked ? "info" : "warn";
                }
            },
            {
                label: 'Показать фаил лога в папке',
                click: () => {
                    shell.showItemInFolder(logger.transports.file.findLogPath());
                }
            },
            {
                label: 'Сбросить Авторизацию', click: () => {
                    resetAuthorization();
                    doAuthenticate();
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Автоматическое сохранение на диск',
                type: 'checkbox',
                checked: global.conf.get('autoSave'),
                click: (item) => {
                    global.conf.set('autoSave', item.checked);
                }
            },
            {
                label: 'Выбрать папку сохранения',
                click: () => {
                    dialog.showOpenDialog({
                            title: "Папка сохранения скриншотов",
                            defaultPath: global.conf.get('saveDir'),
                            properties: ['openDirectory', 'createDirectory']
                        })
                        .then((filePaths) => {
                            if (filePaths && filePaths.length) {
                                logger.info(filePaths);
                                global.conf.set('saveDir', filePaths[0]);
                            }
                        });
                }
            },
            {
                label: 'История',
                click: () => {
                    showHistory();
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Автоматическое обновление (без запроса)',
                type: 'checkbox',
                checked: global.conf.get('silentUpdate'),
                click: (item) => {
                    global.conf.set('silentUpdate', item.checked);
                }
            },
            {
                label: 'О программе (обновления)',
                click: () => {
                    showChangeLog();
                }
            },
            {
                type: 'separator'
            },
            {
                label: 'Завершить', click: () => {
                    quitRequested = true;
                    app.quit();
                }
            }
        ]);

        if (platform === 'linux') {
            let menuItem = new MenuItem({
                label: 'Автозапуск',
                type: 'checkbox',
                checked: !!global.conf.get('autostart') && isAutostartEnabled(),
                click: (item) => {
                    if (item.checked) {
                        enableAutostart();
                        global.conf.set('autostart', true);
                    } else {
                        disableAutostart();
                        global.conf.set('autostart', false);
                    }
                }
            });
            contextMenu.insert(0, menuItem);
        } else {
            if (global.conf.get('autostart')) {
                app.setLoginItemSettings({
                    openAtLogin: true,
                    openAsHidden: true
                });
            } else {
                global.conf.set('autostart', false);
                app.setLoginItemSettings({
                    openAtLogin: false
                });
            }
            let menuItem = new MenuItem({
                label: 'Автозапуск',
                type: 'checkbox',
                checked: app.getLoginItemSettings().openAtLogin,
                click: (item) => {
                    if (item.checked) {
                        app.setLoginItemSettings({
                            openAtLogin: true,
                            openAsHidden: true
                        });
                        global.conf.set('autostart', true);
                    } else {
                        app.setLoginItemSettings({
                            openAtLogin: false
                        });
                        global.conf.set('autostart', false);
                    }
                }
            });
            contextMenu.insert(2, menuItem);
        }

        tray.setToolTip('megagroup screenShotik');
        tray.setContextMenu(contextMenu);

        if (platform === 'darwin') {
            tray.on('right-click', () => {
                makeScreenShot();
            });
        } else {
            tray.on('click', () => {
                makeScreenShot();
            });
        }

        if (!authenticated && !global.conf.get('allowLocalWithoutAuth')) {
            doAuthenticate();
        }
        const menu = defaultMenu(app, shell, isDev);
        Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
    });

    app.on('window-all-closed', function () {
        // приложение живёт в трее
    });

    app.on('activate', function () {
        // на macOS пересоздаём окно по клику на иконку в доке
    });

    app.on('will-quit', () => {
        logger.info("will quit");
        globalShortcut.unregisterAll();
    });

    app.on('browser-window-blur', function (e) {
        logger.info('browser-window-blur');
        if (e.sender && mainWindow && !mainWindow.isDestroyed() && e.sender === mainWindow && global.conf.get('cancelOnBlur') && (authenticated || quitRequested) && !(history && !history.isDestroyed() && history.isFocused()) && !(changeLog && !changeLog.isDestroyed() && changeLog.isFocused())) {
            mainWindow.webContents.send('destroy', {one: true});
        }
    });

    const handleExit = (signal) => {
        logger.info(`Caught ${signal}. Exiting.`);
        quitRequested = true;
        app.quit();
    };
    process.on("SIGINT", () => handleExit("SIGINT"));
    process.on("SIGTERM", () => handleExit("SIGTERM"));
}