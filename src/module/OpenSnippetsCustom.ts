//打开自定义片断补全配置文件
import * as vscode from 'vscode';
import { Util } from '../util/Util';
import { WorkspaceManager } from '../util/WorkspaceManager';

function openSnippetsCustom() {
    Util.getInstance().openFileInVscode(WorkspaceManager.getInstance().getExtensionDir() + "\\snippets\\snippets_custom.json");
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.openSnippetsCustom', openSnippetsCustom));
}
