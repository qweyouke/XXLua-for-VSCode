//调试器 工具类
import * as os from 'os';

const FILTER:any = {
    "local": true,
    "function": true,
    "true": true,
    "false": true,
    "do": true,
    "end": true,
    "then": true,
    "nil": true,
    "if": true,
    "while": true,
    "return": true,
    "elseif": true,
    "break": true,
    "for": true,
    "else": true,
    "or": true,
    "and": true,
    "goto": true,
    "not": true
};

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

const PRINT_FORMAT = {
    [PrintType.normal]: "\x1b[38;2;55;148;255m[%s]: %s\x1b[39m\n",
    [PrintType.warning]: "\x1b[38;2;204;167;0m[%s]: %s\x1b[39m\n",
    [PrintType.error]: "\x1b[38;2;244;135;113m[%s]: %s\x1b[39m\n"
}

const REPLACE_EXTRA_REGEXP = /\s{1}\[.*?\]/;


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

    public getPrintFormat(type: PrintType): string {
        return PRINT_FORMAT[type];
    }

    //是否是过滤字符串
    public isFilterStr(v: string): boolean {
        return FILTER[v];
    }

    //获取本机ip
    public getIPAdress(): string {
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
        return "127.0.0.1";
    }

    public getNowTimeStr(): string {
        return new Date().toLocaleTimeString(undefined, { hour12: false });
    }

    //清除附加参数名
    public filterExternalKey(key: string) {
        return key.replace(REPLACE_EXTRA_REGEXP, "");
    }

}