//配置
import * as vscode from 'vscode';
import { Util } from './Util';
import { WorkspaceManager } from './WorkspaceManager';
import { LOCAL_DATA_NAME } from './Define';

export class Update {
    static _instance: Update;
    static getInstance() {
        if (!Update._instance) {
            Update._instance = new Update();
        }
        return Update._instance;
    }

    private mLuaDebugPath: string | undefined;
    private mUnityDebugPath: string| undefined;

    constructor() {

    }

    //准备检查更新
    public readyCheckUpdate(){
        WorkspaceManager.getInstance().initFileList(()=>{
            this.checkLuaDebugUpdate();
        });
    }

    //检查lua调试器更新
    private checkLuaDebugUpdate(){
        if (this.isLoadLuaDebug()) {
            if (this.isLuaDebugLowVersion()) {
                vscode.window.showWarningMessage("发现Lua调试器版本更新，是否更新调试文件", '更新(推荐)', '忽略', '跳过本次更新')
                .then( (select) => {
                    if (select === "更新(推荐)") {
                        var luaDebugPath = this.getLocalLuaDebugPath();
                        if (luaDebugPath) {
                            this.importLuaDebuger(luaDebugPath);
                            this.checkUnityDebugUpdate();
                        }else{
                            this.checkLuaDebugUpdate();
                        }
                    } else{
                        if (select === "跳过本次更新") {
                            this.updateLocalLuaDebugVersion();
                        } 
                        this.checkUnityDebugUpdate();
                    }
                });
            }else{
                this.checkUnityDebugUpdate();
            }
        }else{
            const importLuaDebuger = () => {
                vscode.window.showWarningMessage("Lua调试文件缺失，是否导入 (Lua调试文件缺失将导致不能使用调试功能)", '导入', '忽略')
                    .then( (select) => {
                        if (select === "导入") {
                            this.showImportLuaDebugerDialog(
                                (ret) => {
                                    if (ret) {
                                        this.checkUnityDebugUpdate();
                                    } else {
                                        importLuaDebuger();
                                    }
                                });
                        } else {
                            this.checkUnityDebugUpdate();
                        }
                    });
            };
            importLuaDebuger();
        }
    }

    //检查unity调试器更新
    private checkUnityDebugUpdate(){
        if (this.isDisableUnityDebug()) {
            return;
        }

        if (this.isLoadUnityDebug()) {
            if (this.isUnityDebugLowVersion()) {
                vscode.window.showWarningMessage("发现Unity调试器版本更新，是否更新调试文件", '更新(推荐)', '忽略', '跳过本次更新')
                .then( (select) => {
                    if (select === "更新(推荐)") {
                        var unityDebugPath = this.getLocalUnityDebugPath();
                        if (unityDebugPath) {
                            this.importUnityDebug(unityDebugPath);
                        }else{
                            this.checkUnityDebugUpdate();
                        }
                    } else if (select === "跳过本次更新") {
                        this.updateLocalUnityDebugVersion();
                    }
                });
            }
        }else{
            const importUnityDebuger = () => {
                vscode.window.showWarningMessage("Unity调试文件缺失，是否导入 (非Unity项目无需导入， Unity项目缺失本调试文件将导致调试时不能获取C#变量值)", '导入', '不再提示','忽略')
                    .then( (select) => {
                        if (select === "导入") {
                            this.showImportUnityDialog(
                                (ret) => {
                                    if (!ret){
                                        importUnityDebuger();
                                    }
                                }
                            );
                        }else if(select === "不再提示"){
                            this.setDisableUnityDebug(true);
                        }
                    });
            };
            importUnityDebuger();
        }
    }

    //--------------------------------------------------------------------------------------------

    //是否已加载lua调试器
    public isLoadLuaDebug(): boolean {
        return this.getLocalLuaDebugPath() ? true : false;
    }

    //Lua调试器是否版本不匹配
    public isLuaDebugLowVersion(): boolean {
        return this.getLocalLuaDebugVersion() !== this.getExtensionLuaDebugVersion();
    }

    //获取本地lua调试器版本
    public getLocalLuaDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getWorkspaceLocalData()?.get(LOCAL_DATA_NAME.luaDebugVersion);
    }
    
    //获取插件lua调试器版本
    public getExtensionLuaDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getExtension()?.packageJSON.luaDebugVersion;
    }

    //更新本地lua调试器版本
    public updateLocalLuaDebugVersion(): void {
        WorkspaceManager.getInstance().getWorkspaceLocalData()?.update(LOCAL_DATA_NAME.luaDebugVersion, this.getExtensionLuaDebugVersion());
    }

    //--------------------------------------------------------------------------------------------

    //是否禁用unity调试器
    public isDisableUnityDebug(): boolean | undefined {
        return WorkspaceManager.getInstance().getWorkspaceLocalData()?.get(LOCAL_DATA_NAME.isDisableUnityDebug);
    }

    //设置是否禁用unity调试器
    public setDisableUnityDebug(isDisabled:boolean): void {
        WorkspaceManager.getInstance().getWorkspaceLocalData()?.update(LOCAL_DATA_NAME.isDisableUnityDebug, isDisabled);
    }

    //是否已加载unity调试器
    public isLoadUnityDebug(): boolean {
        return this.getLocalUnityDebugPath() ? true : false;
    }

    //Unity调试器是否版本不匹配
    public isUnityDebugLowVersion(): boolean {
        return this.getLocalUnityDebugVersion() !== this.getExtensionUnityDebugVersion();
    }

    //获取本地unity调试器版本
    public getLocalUnityDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getWorkspaceLocalData()?.get(LOCAL_DATA_NAME.unityDebugVersion);
    }

    //获取插件unity调试器版本
    public getExtensionUnityDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getExtension()?.packageJSON.unityDebugVersion;
    }

    //更新本地unity调试器版本
    public updateLocalUnityDebugVersion(): void {
        WorkspaceManager.getInstance().getWorkspaceLocalData()?.update(LOCAL_DATA_NAME.unityDebugVersion, this.getExtensionUnityDebugVersion());
    }

    //--------------------------------------------------------------------------------------------

 

    //打开导入Lua调试脚本弹窗
    public showImportLuaDebugerDialog(func: ((ret: boolean) => void) | undefined = undefined) {
        this.showImportDebugFilesOpenDialog("导入", (path) => {
            if (path) {
                this.importLuaDebuger(path);
            }
            if (func) {
                func(path && true || false);
            }
        });
    }

    //打开导入Unity调试脚本弹窗
    public showImportUnityDialog(func: ((ret: boolean) => void) | undefined = undefined) {
        this.showImportDebugFilesOpenDialog("选择Unity工程的Scripts目录导入", (path) => {
            if (path) {
                this.importUnityDebug(path);
            }
            if (func) {
                func(path && true || false);
            }
        });
    }

    //导入lua脚本
    public importLuaDebuger(path: string) {
        var from = WorkspaceManager.getInstance().getExtensionDir() + "/other/lua/";
        var to;
        const idx = path.lastIndexOf("/");
        const lastDir = path.substring(idx+1,path.length);
        if (lastDir === "Debug") {
            to = path;
        }else{
            to = path + "/Debug";
        }
        Util.getInstance().copyDir(from, to);
        Util.getInstance().openFileInFinder(to);
        this.updateLocalLuaDebugVersion();
        WorkspaceManager.getInstance().getWorkspaceLocalData()?.update(LOCAL_DATA_NAME.luaDebugPath, to);
    }

    //导入unity脚本
    public importUnityDebug(path: string) {
        var from = WorkspaceManager.getInstance().getExtensionDir() + "/other/cs/";
        var to;
        const idx = path.lastIndexOf("/");
        const lastDir = path.substring(idx+1,path.length);
        if (lastDir === "Debug") {
            to = path;
        }else{
            to = path + "/Debug";
        }
        Util.getInstance().copyDir(from, to);
        Util.getInstance().openFileInFinder(to);
        this.setDisableUnityDebug(false);
        this.updateLocalUnityDebugVersion();
        WorkspaceManager.getInstance().getWorkspaceLocalData()?.update(LOCAL_DATA_NAME.unityDebugPath, to);
    }

    //打开导入调试文件弹窗
    private showImportDebugFilesOpenDialog(msg: string, func: (retPath: string | undefined) => void) {
        Util.getInstance().showOpenDialog(msg,
            (path: string | undefined) => {
                if (path) {
                    let idx = path.lastIndexOf("\\");
                    if (idx !== -1) {
                        let lastPath = path.substring(idx + 1, path.length);
                        if (lastPath === "Debug") {
                            path = path.substring(0, idx);
                        }
                    }
                    func(path);
                } else {
                    func(undefined);
                }
            }
        );
    }

    //获取工作区lua调试器路径
    public getLocalLuaDebugPath(): string | undefined {
        if (this.mLuaDebugPath) {
            return this.mLuaDebugPath;
        }
        let debugPath = WorkspaceManager.getInstance().getExtensionLuaDebugPath();
        let files = Util.getInstance().readDir(debugPath);
        let dirPath:string|undefined = undefined;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileName = Util.getInstance().getFileName(file);
            let fullPath = WorkspaceManager.getInstance().getFileFullPath(fileName);
            if (!fullPath || (fullPath instanceof Array && fullPath.length > 1)) {
                //不存在或有多个同名文件，匹配失败
                dirPath = undefined;
                break;
            }else{
                let dirPath2 = Util.getInstance().getDirPath(fullPath instanceof Array ? fullPath[0] : fullPath);
                if (!dirPath) {
                    dirPath = dirPath2;
                }if (dirPath !== dirPath2) {
                    //文件路径不一致，匹配失败
                    dirPath = undefined;
                    break;
                }
            }
        }
        //找不到就读配置
        if (!dirPath) {
            dirPath = WorkspaceManager.getInstance().getWorkspaceLocalData()?.get(LOCAL_DATA_NAME.luaDebugPath);
        }
        this.mLuaDebugPath = dirPath;
        return dirPath;
    }
    
    //获取工作区unity调试器路径
    public getLocalUnityDebugPath(): string | undefined {
        if (this.mUnityDebugPath) {
            return this.mUnityDebugPath;
        }
        //优先查找本地文件
        let debugPath = WorkspaceManager.getInstance().getExtensionUnityDebugPath();
        let files = Util.getInstance().readDir(debugPath);
        let dirPath:string|undefined = undefined;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileName = Util.getInstance().getFileName(file);
            let fullPath = WorkspaceManager.getInstance().getFileFullPath(fileName);
            if (!fullPath || (fullPath instanceof Array && fullPath.length > 1)) {
                //不存在或有多个同名文件，匹配失败
                dirPath = undefined;
                break;
            }else{
                let dirPath2 = Util.getInstance().getDirPath(fullPath instanceof Array ? fullPath[0] : fullPath);
                if (dirPath && dirPath !== dirPath2) {
                    //文件路径不一致，匹配失败
                    dirPath = undefined;
                    break;
                }
                dirPath = dirPath2;
            }
        }
        //找不到就读配置
        if (!dirPath) {
            dirPath = WorkspaceManager.getInstance().getWorkspaceLocalData()?.get(LOCAL_DATA_NAME.unityDebugPath);
        }
        this.mUnityDebugPath = dirPath;
        return dirPath;
    }
}