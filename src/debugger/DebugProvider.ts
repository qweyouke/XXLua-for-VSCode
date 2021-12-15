//调试器 通信类
import { WorkspaceManager } from "../util/WorkspaceManager";
import {PrintType} from "./DebugUtil";
import * as vscode from 'vscode';
import * as Proto from './Proto';

export class DebugProvider {
    private static _instance: DebugProvider;
    public static getInstance() {
        if (!DebugProvider._instance) {
            DebugProvider._instance = new DebugProvider();
        }
        return DebugProvider._instance;
    }

    private mSession: vscode.DebugSession | undefined;

    constructor(){
        this.mSession = undefined;
    }

    public init(context: vscode.ExtensionContext){
        context.subscriptions.push(vscode.debug.onDidReceiveDebugSessionCustomEvent(e => {
            this.onDebugCustomEvent(e);
        }));
        context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(e => this.onTerminateDebugSession(e)));
    }

    onDebugCustomEvent(e: vscode.DebugSessionCustomEvent) {
        this.mSession = e.session;
        if (e.event === Proto.EVENT.getFullPath) {
            var fullPath = WorkspaceManager.getInstance().getFileFullPath(e.body.filePath);
            if (fullPath) {
                if (fullPath instanceof Array) {
                    fullPath = fullPath[0];
                }
            }
            this.mSession.customRequest(Proto.EVENT.getFullPath, { fullPath: fullPath, idx: e.body.idx});
        } else if (e.event === Proto.EVENT.showDialogMessage) {
            this.showDialog(e.body.type, e.body.msg);
        } else if(e.event === Proto.EVENT.initDebugEnv){
            WorkspaceManager.getInstance().initFileList(
                ()=>{
                    if (this.mSession) {
                        this.mSession.customRequest(Proto.EVENT.initDebugEnv, {luaRoot: WorkspaceManager.getInstance().getLuaRoot()});
                    }
                }
            );
        }
    }

    private showDialog(type: number, msg: string){
        if (type === 1) {
            vscode.window.showInformationMessage(msg);
        } else if (type === 2) {
            vscode.window.showWarningMessage(msg);
        } else {
            vscode.window.showErrorMessage(msg);
        }
    }

    onTerminateDebugSession(session: vscode.DebugSession) {}

    reloadLua(path: string, fullPath: string) {
        if (this.mSession) {
            this.mSession.customRequest(Proto.EVENT.reloadLua, { luaPath: path, fullPath: fullPath });
        } else {
            vscode.window.showWarningMessage("重载失败，调试器未启动");
        }
    }

    printConsole(msg:string, type:number = PrintType.normal) {
        if (this.mSession) {
            this.mSession.customRequest(Proto.EVENT.printConsole, { msg: msg, type: type });
        }
    }
}