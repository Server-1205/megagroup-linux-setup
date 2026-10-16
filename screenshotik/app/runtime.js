'use strict';

// Общий объект для рантайм-данных, которые раньше клались в global
// и читались через electron.remote.getGlobal(...).

module.exports = {
    authInfo: null
};