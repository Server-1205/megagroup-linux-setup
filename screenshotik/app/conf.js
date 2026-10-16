'use strict';

// Минималистичный JSON-стор, заменяющий electron-store (v1 API):
//   get(key[, default]) / set(key, value) / has(key) / delete(key) / clear() / store
// Файл лежит в userData, поэтому доступен и главному процессу, и рендерерам
// (рендереры узнают путь через process.env.SHOTIK_USER_DATA, который
//  выставляет main.js до создания окон).

const fs = require('fs');
const path = require('path');

const userDataDir = () => {
    if (process.env.SHOTIK_USER_DATA) {
        return process.env.SHOTIK_USER_DATA;
    }
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(home, '.config', 'screenShotik');
};

class Store {
    constructor(name = 'shotik') {
        this.name = name;
        this._cache = null;
        this._mtime = 0;
    }

    // Путь считается лениво: окружение рендереров может отличаться
    get path() {
        return path.join(userDataDir(), this.name + '.json');
    }

    _read() {
        try {
            const stat = fs.statSync(this.path);
            if (this._cache && stat.mtimeMs === this._mtime) {
                return this._cache;
            }
            const data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
            this._cache = data;
            this._mtime = stat.mtimeMs;
            return data;
        } catch (e) {
            this._cache = {};
            this._mtime = 0;
            return this._cache;
        }
    }

    _write(data) {
        fs.mkdirSync(path.dirname(this.path), {recursive: true});
        const tmp = this.path + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, this.path);
        this._cache = data;
        try {
            this._mtime = fs.statSync(this.path).mtimeMs;
        } catch (e) {
            this._mtime = 0;
        }
    }

    get(key, defaultValue) {
        const data = this._read();
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }
        return defaultValue;
    }

    set(key, value) {
        const data = this._read();
        data[key] = value;
        this._write(data);
    }

    has(key) {
        return Object.prototype.hasOwnProperty.call(this._read(), key);
    }

    delete(key) {
        const data = this._read();
        delete data[key];
        this._write(data);
    }

    clear() {
        this._write({});
    }

    get store() {
        return this._read();
    }

    set store(value) {
        this._write(Object.assign({}, value));
    }
}

const createStore = (name) => new Store(name);

// main.js выставляет SHOTIK_CONF_NAME, чтобы главный процесс и рендереры
// работали с одним и тем же файлом настроек
module.exports = new Store(process.env.SHOTIK_CONF_NAME || 'shotik');
module.exports.createStore = createStore;
module.exports.Store = Store;
module.exports.userDataDir = userDataDir;