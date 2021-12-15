//导入unity调试文件
import * as vscode from 'vscode';
import { Util } from '../util/Util';
import { Update } from "../util/Update";

function importUnityDebuger(uri: vscode.Uri) {
    if (uri.fsPath) {
        var dir = Util.getInstance().getDirPath(uri.fsPath);
        Update.getInstance().importUnityDebug(dir);
    } else {
        Update.getInstance().showImportUnityDialog();
    }
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.importUnityDebuger', importUnityDebuger));
}
