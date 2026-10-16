'use strict';

// Захват экрана. На Windows/macOS и на X11 это обычный desktopCapturer.
// На Wayland (Hyprland/wlroots) Chromium-захват экрана упирается в
// xdg-desktop-portal, поэтому там используется grim: он снимает
// скомпонованный рабочий стол целиком, а выбранный монитор вырезается
// из него в screenshooter.js (там уже есть логика cropX/cropY).

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {desktopCapturer} = require('electron');
const log = require('./log');

const toolTimeout = Number(process.env.SHOTIK_CAPTURE_TIMEOUT || 5000);
const attempts = Number(process.env.SHOTIK_CAPTURE_ATTEMPTS || 3);
const retryDelay = Number(process.env.SHOTIK_CAPTURE_RETRY_DELAY || 300);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isWayland = () =>
    !!process.env.WAYLAND_DISPLAY && process.env.XDG_SESSION_TYPE !== 'x11';

const which = (bin) => {
    const dirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of dirs) {
        if (!dir) continue;
        const full = path.join(dir, bin);
        try {
            fs.accessSync(full, fs.constants.X_OK);
            return full;
        } catch (e) {
            /* ищем дальше */
        }
    }
    return null;
};

const captureTool = () => {
    if (process.env.SHOTIK_CAPTURE_TOOL) {
        return which(process.env.SHOTIK_CAPTURE_TOOL) ? which(process.env.SHOTIK_CAPTURE_TOOL) : null;
    }
    return which('grim');
};

const writeTmp = (saveDir, buffer) => {
    const file = path.join(saveDir, '_tmpScreen.png');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, buffer);
    return file;
};

const tmpPath = (saveDir) => {
    const file = path.join(saveDir, '_tmpScreen.png');
    fs.mkdirSync(path.dirname(file), {recursive: true});
    return file;
};

const captureWithTool = (display, saveDir) => {
    const bin = captureTool();
    if (!bin) return null;
    const file = tmpPath(saveDir);
    const args = [];
    if (process.env.SHOTIK_CAPTURE_OUTPUT) {
        args.push('-o', process.env.SHOTIK_CAPTURE_OUTPUT);
    }
    // grim без аргументов пишет в stdout, но там пусто — путь обязателен
    args.push(file);
    // Жёсткий таймаут обязателен: если композитор не отдаёт кадр,
    // grim виснет бесконечно и блокирует все следующие запросы screencopy.
    execFileSync(bin, args, {env: process.env, timeout: toolTimeout, killSignal: 'SIGKILL'});
    let size = 0;
    try {
        size = fs.statSync(file).size;
    } catch (e) {
        size = 0;
    }
    if (!size) {
        throw new Error(path.basename(bin) + ' не создал файл снимка');
    }
    log.info('captured with ' + path.basename(bin) + ', bytes: ' + size);
    return file;
};

const captureWithElectron = async (display, saveDir) => {
    const displays = require('electron').screen.getAllDisplays();
    let width = 0, height = 0, maxScaleFactor = display.scaleFactor || 1;
    for (const d of displays) {
        maxScaleFactor = Math.max(maxScaleFactor, d.scaleFactor || 1);
        width = Math.max(width, d.bounds.x + d.bounds.width);
        height = Math.max(height, d.bounds.y + d.bounds.height);
    }
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: Math.round(width * maxScaleFactor),
            height: Math.round(height * maxScaleFactor)
        }
    });
    if (!sources.length) {
        throw new Error('desktopCapturer не вернул ни одного экрана');
    }
    let source = sources.find((s) => s.id === 'screen:' + display.id);
    if (!source) {
        source = sources[0];
        display.scaleFactor = maxScaleFactor;
    }
    return writeTmp(saveDir, source.thumbnail.toPNG());
};

// Возвращает путь к PNG со снимком рабочего стола.
const capture = async (display, saveDir) => {
    if (isWayland()) {
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const file = captureWithTool(display, saveDir);
                if (file) {
                    return file;
                }
                log.warn('инструмент захвата не найден, пробуем desktopCapturer');
                break;
            } catch (e) {
                log.error('захват через ' + path.basename(String(e.message || '')) +
                    ' не удался (попытка ' + attempt + '/' + attempts + '): ' + (e.message || e));
            }
            await sleep(retryDelay);
        }
    }
    return captureWithElectron(display, saveDir);
};

module.exports = {
    capture,
    isWayland
};