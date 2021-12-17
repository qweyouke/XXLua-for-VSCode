//调试器 工具类
import * as os from 'os';

const FILTER = [
    "local",
    "function",
    "true",
    "false",
    "do",
    "end",
    "then",
    "nil",
    "if",
    "while",
    "return",
    "elseif",
    "break",
    "for",
    "else",
    "or",
    "and",
    "goto",
];

export const enum PrintType {
    normal,
    warning,
    error
};

//0普通 1警告 2错误
const PRINT_TYPE_STR = {
    [PrintType.normal]: "stdout",
    [PrintType.warning]: "console",
    [PrintType.error]: "stderr"
};



export class DebugUtil {
    private static _util: DebugUtil;
    public static getInstance() {
        if (!DebugUtil._util) {
            DebugUtil._util = new DebugUtil();
        }
        return DebugUtil._util;
    }

    //获取打印类型
    public getPrintTypeStr(type: PrintType): string {
        return PRINT_TYPE_STR[type];
    }

    //是否是过滤字符串
    public isFilterStr(v: string): boolean {
        for (const key in FILTER) {
            let filter = FILTER[key];
            if (filter === v) {
                return true;
            }
        }
        return false;
    }

    //获取本机ip
    public getIPAdress(): string | undefined {
        var interfaces = os.networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];
            if (iface) {
                for (var i = 0; i < iface.length; i++) {
                    var alias = iface[i];
                    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
        }
    }

    public getNowTimeStr(): string {
        return new Date().toLocaleTimeString(undefined, { hour12: false });
    }

}