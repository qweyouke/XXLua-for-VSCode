//复制require("")的lua路径到粘贴板
import * as vscode from 'vscode';
import { Util } from '../util/Util';

function luaPathCopy(uri: vscode.Uri) {
    const luaPath = Util.getInstance().parseToLuaPath(uri.fsPath);
    if (luaPath) {
        vscode.env.clipboard.writeText(luaPath);
        vscode.window.setStatusBarMessage("\"" + luaPath + "\"已复制到粘贴板");
    }
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.luaPathCopy', luaPathCopy));
}
