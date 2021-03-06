//配置
import * as vscode from 'vscode';
import { Util } from './Util';
import { WorkspaceManager } from './WorkspaceManager';
import { LOCAL_DATA_NAME, UNITY_DEBUG_FILE } from './Define';
import path = require('path');

export class Update {
    static _instance: Update;
    static getInstance() {
        if (!Update._instance) {
            Update._instance = new Update();
        }
        return Update._instance;
    }

    private mLuaDebugPath: string | undefined;
    private mUnityDebugPath: string | undefined;
    private mLuaFrameworks: string[] | undefined;

    constructor() {

    }

    //准备检查更新
    public readyCheckUpdate() {
        WorkspaceManager.getInstance().initFileList(() => {
            this.checkLuaDebugUpdate();
        });
    }

    //检查lua调试器更新
    private checkLuaDebugUpdate() {
        if (this.isLoadLuaDebug()) {
            if (this.isLuaDebugLowVersion()) {
                vscode.window.showWarningMessage("发现Lua调试器版本更新，是否更新调试文件", '更新(推荐)', '忽略', '跳过本次更新')
                    .then((select) => {
                        if (select === "更新(推荐)") {
                            var luaDebugPath = this.getLocalLuaDebugPath();
                            vscode.window.showInformationMessage("找到缓存路径:\n" + luaDebugPath + "\n是否导入？", "导入", "重新选择路径").then((select) => {
                                if (select === "导入") {
                                    this.importLuaDebuger(luaDebugPath);
                                    this.checkUnityDebugUpdate();
                                } else if (select === "重新选择路径") {
                                    this.showImportLuaDebugerDialog(
                                        (ret) => {
                                            if (ret) {
                                                this.checkUnityDebugUpdate();
                                            } else {
                                                this.checkLuaDebugUpdate();
                                            }
                                        }
                                    );
                                } else {
                                    this.checkLuaDebugUpdate();
                                }
                            });
                        } else {
                            if (select === "跳过本次更新") {
                                this.updateLocalLuaDebugVersion();
                            }
                            this.checkUnityDebugUpdate();
                        }
                    });
            } else {
                this.checkUnityDebugUpdate();
            }
        } else {
            const importLuaDebuger = () => {
                vscode.window.showWarningMessage("Lua调试文件缺失，是否导入 (Lua调试文件缺失将导致不能使用调试功能)", '导入', '忽略')
                    .then((select) => {
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

    //显示选择unity lua框架
    public showSelectLuaFramework(func: ((select: string | undefined) => void)): void {
        vscode.window.showInformationMessage("选择你的Lua框架", ...this.getExtensionLuaFramework())
            .then((select) => {
                if (select) {
                    this.updateLocalLuaFramework(select);
                }
                func(select);
            }
            );
    }

    //检查unity调试器更新
    private checkUnityDebugUpdate() {
        if (this.isDisableUnityDebug()) {
            return;
        }

        const doImport = () => {
            this.showSelectLuaFramework((select) => {
                if (!select) {
                    this.checkUnityDebugUpdate();
                } else {
                    this.showImportUnityDialog(
                        (ret) => {
                            if (!ret) {
                                this.checkUnityDebugUpdate();
                            }
                        },
                        select
                    );
                }
            });

        };

        if (this.isLoadUnityDebug()) {
            if (this.isUnityDebugLowVersion()) {
                vscode.window.showWarningMessage("发现Unity调试器版本更新，是否更新调试文件", '更新(推荐)', '忽略', '跳过本次更新')
                    .then((select) => {
                        if (select === "更新(推荐)") {
                            var unityDebugPath = this.getLocalUnityDebugPath();
                            vscode.window.showInformationMessage("找到缓存路径:\n" + unityDebugPath + "\n是否导入？", "导入", "重新选择路径").then((select) => {
                                if (select === "导入") {
                                    this.importUnityDebug(unityDebugPath, this.getLocalLuaFramework());
                                } else if (select === "重新选择路径") {
                                    doImport();
                                } else {
                                    this.checkUnityDebugUpdate();
                                }
                            });
                        } else if (select === "跳过本次更新") {
                            this.updateLocalUnityDebugVersion();
                        }
                    });
            }
        } else {
            const importUnityDebuger = () => {
                vscode.window.showWarningMessage("Unity调试文件缺失，是否导入 (非Unity项目无需导入， Unity项目缺失本调试文件将导致调试时不能获取C#变量值)", '导入', '不再提示', '忽略')
                    .then((select) => {
                        if (select === "导入") {
                            doImport();
                        } else if (select === "不再提示") {
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
        return WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.luaDebugVersion);
    }

    //获取插件lua调试器版本
    public getExtensionLuaDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getExtension()?.packageJSON.luaDebugVersion;
    }

    //更新本地lua调试器版本
    public updateLocalLuaDebugVersion(): void {
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.luaDebugVersion, this.getExtensionLuaDebugVersion());
    }

    //--------------------------------------------------------------------------------------------

    //是否禁用unity调试器
    public isDisableUnityDebug(): boolean | undefined {
        return WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.isDisableUnityDebug);
    }

    //设置是否禁用unity调试器
    public setDisableUnityDebug(isDisabled: boolean): void {
        if (isDisabled) {
            vscode.window.showInformationMessage("已禁用unity调试器，如需重新启用unity调试器，可在VSCode资源管理器点击鼠标右键-导入Unity调试文件");
        }
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.isDisableUnityDebug, isDisabled);
    }

    //是否已加载unity调试器
    public isLoadUnityDebug(): boolean {
        return (this.getLocalUnityDebugPath() && this.getLocalLuaFramework()) ? true : false;
    }

    //Unity调试器是否版本不匹配
    public isUnityDebugLowVersion(): boolean {
        return this.getLocalUnityDebugVersion() !== this.getExtensionUnityDebugVersion();
    }

    //获取本地unity调试器版本
    public getLocalUnityDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.unityDebugVersion);
    }

    //获取插件unity调试器版本
    public getExtensionUnityDebugVersion(): string | undefined {
        return WorkspaceManager.getInstance().getExtension()?.packageJSON.unityDebugVersion;
    }

    //更新本地unity调试器版本
    public updateLocalUnityDebugVersion(): void {
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.unityDebugVersion, this.getExtensionUnityDebugVersion());
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
    public showImportUnityDialog(func: ((ret: boolean) => void) | undefined = undefined, luaFramework: string | undefined = undefined) {
        if (!luaFramework) {
            luaFramework = this.getLocalLuaFramework();
        }
        this.showImportDebugFilesOpenDialog("导入", (path) => {
            if (path) {
                this.importUnityDebug(path, luaFramework);
            }
            if (func) {
                func(path && true || false);
            }
        });
    }

    //导入lua脚本
    public importLuaDebuger(path: string | undefined) {
        if (!path) {
            return;
        }
        var from = WorkspaceManager.getInstance().getExtensionDir() + "/other/lua/";
        var to;
        const idx = path.lastIndexOf("/");
        const lastDir = path.substring(idx + 1, path.length);
        if (lastDir === "Debug") {
            to = path;
        } else {
            to = path + "/Debug";
        }
        Util.getInstance().copyDir(from, to);
        Util.getInstance().openFileInFinder(to);
        this.updateLocalLuaDebugVersion();
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.luaDebugPath, to);
    }

    //获取Unity脚本路径
    public getUnityDebugPath(luaFramework: string) {
        return WorkspaceManager.getInstance().getExtensionDir() + "/other/cs/LuaDebugTool_" + luaFramework + ".cs";
    }

    //导入unity脚本
    public importUnityDebug(path: string | undefined, luaFramework: string | undefined = undefined) {
        if (!path) {
            return;
        }
        if (!luaFramework) {
            luaFramework = this.getLocalLuaFramework();
        }
        if (!luaFramework) {
            return;
        }
        var from = this.getUnityDebugPath(luaFramework);
        var to;
        const idx = path.lastIndexOf("/");
        const lastDir = path.substring(idx + 1, path.length);
        if (lastDir === "Debug") {
            to = path;
        } else {
            to = path + "/Debug";
        }
        to = to + "/" + UNITY_DEBUG_FILE;
        Util.getInstance().copy(from, to);
        Util.getInstance().openFileInFinder(Util.getInstance().getDirPath(to));
        this.setDisableUnityDebug(false);
        this.updateLocalUnityDebugVersion();
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.unityDebugPath, to);
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
        let dirPath: string | undefined = undefined;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileName = Util.getInstance().getFileName(file);
            let fullPath = WorkspaceManager.getInstance().getFileFullPath(fileName);
            if (!fullPath || (fullPath instanceof Array && fullPath.length > 1)) {
                //不存在或有多个同名文件，匹配失败
                dirPath = undefined;
                break;
            } else {
                let dirPath2 = Util.getInstance().getDirPath(fullPath instanceof Array ? fullPath[0] : fullPath);
                if (!dirPath) {
                    dirPath = dirPath2;
                } if (dirPath !== dirPath2) {
                    //文件路径不一致，匹配失败
                    dirPath = undefined;
                    break;
                }
            }
        }
        //找不到就读配置
        if (!dirPath) {
            dirPath = WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.luaDebugPath);
        }
        this.mLuaDebugPath = dirPath;
        return dirPath;
    }

    //获取unity lua框架
    public getLocalLuaFramework(): string | undefined {
        return WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.unityDebugLuaFramework);
    }

    //设置unity lua框架
    public updateLocalLuaFramework(str: string) {
        WorkspaceManager.getInstance().updateLocalData(LOCAL_DATA_NAME.unityDebugLuaFramework, str);
    }

    //获取插件unity lua框架
    public getExtensionLuaFramework(): string[] {
        if (!this.mLuaFrameworks) {
            this.mLuaFrameworks = [];

            let debugPath = WorkspaceManager.getInstance().getExtensionUnityDebugPath();
            let files = Util.getInstance().readDir(debugPath);
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                let fileName = Util.getInstance().getFileName(file, true);
                let match = fileName.match(/\w+_(\w+)/);
                if (match) {
                    this.mLuaFrameworks.push(match[1]);
                }
            }
        }

        return this.mLuaFrameworks;
    }

    //获取工作区unity调试器路径
    public getLocalUnityDebugPath(): string | undefined {
        if (this.mUnityDebugPath) {
            return this.mUnityDebugPath;
        }
        //优先查找本地文件
        let dirPath: string | undefined = undefined;
        let fullPath = WorkspaceManager.getInstance().getFileFullPath(UNITY_DEBUG_FILE);
        if (!fullPath || (fullPath instanceof Array && fullPath.length > 1)) {
            //不存在或有多个同名文件，匹配失败

            //找不到就读配置
            dirPath = WorkspaceManager.getInstance().getLocalData(LOCAL_DATA_NAME.unityDebugPath);
        } else {
            dirPath = Util.getInstance().getDirPath(fullPath instanceof Array ? fullPath[0] : fullPath);
        }
        this.mUnityDebugPath = dirPath;
        return dirPath;
    }
}