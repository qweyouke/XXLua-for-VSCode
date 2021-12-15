//导入lua调试文件
import * as vscode from 'vscode';
import { Util } from '../util/Util';
import { Update } from "../util/Update";

function importLuaDebuger(uri: vscode.Uri) {
    if (uri.fsPath) {
        var dir = Util.getInstance().getDirPath(uri.fsPath);
        Update.getInstance().importLuaDebuger(dir);
    } else {
        Update.getInstance().showImportLuaDebugerDialog();
    }
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.importLuaDebuger', importLuaDebuger));
}
