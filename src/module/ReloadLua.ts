//重载lua文件
import * as vscode from 'vscode';
import { Util } from '../util/Util';
import {DebugProvider} from '../debugger/DebugProvider';

function reloadLua(uri: vscode.Uri) {
    const luaPath = Util.getInstance().parseToLuaPath(uri.fsPath);
    if (luaPath) {
        DebugProvider.getInstance().reloadLua(luaPath, uri.fsPath);
    }
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.reloadLua', (uri) => {
        reloadLua(uri);
    }));
}
