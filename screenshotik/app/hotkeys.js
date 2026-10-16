module.exports = function(platform) {

    const keys = {
        "cmdShift5": "Cmd+Shift+5",
        "cmdShift6": "Cmd+Shift+6",
        "cmdShift7": "Cmd+Shift+7",
        "ctrlPrintScreen": "Control+PrintScreen",
        "shiftCtrlPrintScreen": "Shift+Control+PrintScreen",
        "shiftPrintScreen": "Shift+PrintScreen",
        "PrintScreen": "PrintScreen",
        "shiftF1": "Shift+F1",
        "shiftF12": "Shift+F12",
        "shiftCtrlX": "Shift+Control+X",
        "shiftAltX": "Shift+Alt+X",
    };

    const byPlatform = {
        "keys" : keys,
        "linux": [keys.shiftF1,keys.shiftF12,keys.shiftAltX,keys.shiftCtrlX],
        "linuxDefault": [keys.shiftF1,keys.shiftF12,keys.shiftAltX,keys.shiftCtrlX],
        "win32": [keys.shiftF1,keys.shiftF12,keys.PrintScreen,keys.ctrlPrintScreen,keys.shiftCtrlPrintScreen,keys.shiftPrintScreen,keys.shiftF1,keys.shiftF12,keys.shiftCtrlX,keys.shiftAltX],
        "win32Default": [keys.ctrlPrintScreen,keys.shiftCtrlPrintScreen,keys.shiftPrintScreen],
        "darwin": [keys.cmdShift5, keys.cmdShift6, keys.cmdShift7],
        "darwinDefault": [keys.cmdShift5, keys.cmdShift6, keys.cmdShift7],
        "getSettingName": (name)=>{
            return "hk_"+name.replace('\+',"");
        }
    };

    return {
        "all" : byPlatform[platform],
        "default": byPlatform[platform+"Default"],
        "getSettingName": byPlatform.getSettingName
    }
};