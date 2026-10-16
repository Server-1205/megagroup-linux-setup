'use strict';

// Замена electron-log: тот же интерфейс (transports.file.level,
// transports.console.level, findLogPath), но без лишней зависимости и без
// ESM-проблем в рендерерах.

const fs = require('fs');
const path = require('path');
const {userDataDir} = require('./conf');

const LEVELS = {error: 0, warn: 1, info: 2, verbose: 3, debug: 4};

let logDir = null;
let logFile = null;

const ensurePaths = () => {
    if (!logFile) {
        logDir = path.join(userDataDir(), 'logs');
        logFile = path.join(logDir, 'screenShotik.log');
    }
    return logFile;
};

const makeTransport = (initialLevel) => {
    let level = initialLevel;
    return {
        get level() {
            return level;
        },
        set level(value) {
            level = value;
        },
        findLogPath: ensurePaths
    };
};

// Уровень по умолчанию берём из env: главный процесс выставляет его один раз,
// чтобы рендереры писали в лог так же подробно, как main
const initialLevel = process.env.SHOTIK_LOG_LEVEL || 'warn';
const fileTransport = makeTransport(initialLevel);
const consoleTransport = makeTransport(initialLevel);

const stringify = (args) => args.map((a) => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.message;
    try {
        return JSON.stringify(a);
    } catch (e) {
        return String(a);
    }
}).join(' ');

const write = (level, args) => {
    if (LEVELS[level] > LEVELS[fileTransport.level]) return;
    const line = `[${new Date().toISOString()}] [${level}] ${stringify(args)}\n`;
    try {
        const file = ensurePaths();
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.appendFileSync(file, line);
    } catch (e) {
        /* логирование не должно ронять приложение */
    }
    if (LEVELS[level] > LEVELS[consoleTransport.level]) return;
    if (level === 'error') {
        console.error(line.trimEnd());
    } else if (level === 'warn') {
        console.warn(line.trimEnd());
    } else {
        console.log(line.trimEnd());
    }
};

const logger = {
    transports: {
        file: fileTransport,
        console: consoleTransport
    },
    error: (...args) => write('error', args),
    warn: (...args) => write('warn', args),
    info: (...args) => write('info', args),
    verbose: (...args) => write('verbose', args),
    debug: (...args) => write('debug', args)
};

module.exports = logger;