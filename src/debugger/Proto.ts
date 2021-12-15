//协议
export const CMD = {
    initialize: "initialize",
    launch: "launch",
    attach: "attach",

    disconnect: "disconnect",
    setBreakpoints: "setBreakpoints",
    start: "start",
    pause: "pause",
    continue: "continue",
    next: "next",
    stepIn: "stepIn",
    stepOut: "stepOut",
    stop: "stop",
    getScopes: "getScopes",
    getVariable: "getVariable",
    watchVariable: "watchVariable",
    printConsole: "printConsole",
    reloadLua: "reloadLua",
    showDialogMessage: "showDialogMessage",
    resetStackInfo: "resetStackInfo",
};

//事件
export const EVENT = {
    getFullPath: "getFullPath",
    initDebugEnv: "initDebugEnv",
    reloadLua: "reloadLua",
    showDialogMessage: "showDialogMessage",
    printConsole: "printConsole",
    onReceiveScopes: "onReceiveScopes"
};