// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WorkspaceManager } from './util/WorkspaceManager';
import { Update } from './util/Update';
import * as AutoAnnotation from './module/AutoAnnotation';
import * as Completion from './module/Completion';
import * as Template from './module/Template';
import * as ImportLuaDebuger from './module/ImportLuaDebuger';
import * as ImportUnityDebuger from './module/ImportUnityDebuger';
import * as luaPathCopy from './module/LuaPathCopy';
import * as OpenSnippetsCustom from './module/OpenSnippetsCustom';
import * as ReloadLua from './module/ReloadLua';
import * as LanguageConfiguration from './module/LanguageConfiguration';
import * as InlineValuesProvider from './module/InlineValuesProvider';
import { DebugProvider } from './debugger/DebugProvider';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "XXlua" is now active!');
    WorkspaceManager.getInstance().init(context);
    Completion.init(context);
    Template.init(context);
    ImportLuaDebuger.init(context);
    ImportUnityDebuger.init(context);
    luaPathCopy.init(context);
    OpenSnippetsCustom.init(context);
    ReloadLua.init(context);
    AutoAnnotation.init(context);
    LanguageConfiguration.init(context);
    InlineValuesProvider.init(context);
    DebugProvider.getInstance().init(context);
    Update.getInstance().readyCheckUpdate();
}

export function deactivate() { }
