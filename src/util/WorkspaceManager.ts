//配置
import * as vscode from 'vscode';
import { Util } from './Util';
import { CONFIG_NAME } from './Define';

const EXTENSION_NAME: string = "XXLua";

export class WorkspaceManager {
    static _instance: WorkspaceManager;
    static getInstance() {
        if (!WorkspaceManager._instance) {
            WorkspaceManager._instance = new WorkspaceManager();
        }
        return WorkspaceManager._instance;
    }

    //全局配置
    private mGlobalConfig: vscode.WorkspaceConfiguration | undefined;
    //工作区配置
    private mWorkSpaceConfig: vscode.WorkspaceConfiguration | undefined;
    //本插件实例
    private mExtension: vscode.Extension<any> | undefined;
    //文件列表 右单斜线路径
    private mFiles: Map<string, vscode.Uri>;
    //相对文件路径列表 右单斜线路径
    private mRelativeFilePaths: Map<string, string[]>;
    //lua根节点 右单斜线路径
    private mLuaRoot: string | undefined;
    //lua根节点名
    private mLuaRootName:string | undefined;
    //本扩展上下文
    private mContext: vscode.ExtensionContext | undefined;

    constructor() {
        this.mFiles = new Map<string, vscode.Uri>();
        this.mRelativeFilePaths = new Map<string, string[]>();
    }

    init(context: vscode.ExtensionContext) {
        this.mContext = context;
        
        //工作区发生变化， 初始化工作区配置
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.mWorkSpaceConfig = undefined;
            this.mLuaRoot = undefined;
            this.initFileList();
        });
        //创建文件
        vscode.workspace.onDidCreateFiles((e: vscode.FileCreateEvent) => {
            e.files.forEach(uri => {
                this.addFileCache(uri);
            });
        });
        //删除文件
        vscode.workspace.onDidDeleteFiles((e: vscode.FileDeleteEvent) => {
            e.files.forEach(uri => {
                this.removeFileCache(uri.fsPath);
            });
        });
        //重命名文件
        vscode.workspace.onDidRenameFiles((e: vscode.FileRenameEvent) => {
            e.files.forEach(elm => {
                this.removeFileCache(elm.oldUri.fsPath);
                this.addFileCache(elm.newUri);
            });
        });
        //配置变化
        vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
            this.mGlobalConfig = undefined;
            this.mWorkSpaceConfig = undefined;
        });
    }

    //添加文件缓存
    private addFileCache(uri: vscode.Uri) {
        let fsPath = Util.getInstance().getRightSlashPath(uri.fsPath);
        this.mFiles.set(fsPath, uri);

        let fileName = Util.getInstance().getFileName(fsPath);
        let list = this.mRelativeFilePaths.get(fileName);
        if (!list) {
            list = [];
            this.mRelativeFilePaths.set(fileName, list);
        }
        list.push(fsPath);

        let luaRoot = this.getLuaRoot();
        if (luaRoot) {
            let relativePath = fsPath.replace(luaRoot, '');
            let list = this.mRelativeFilePaths.get(relativePath);
            if (!list) {
                list = [];
                this.mRelativeFilePaths.set(relativePath, list);
            }
            list.push(fsPath);

            var rootName = this.getLuaRootName();
            if (rootName) {
                let rootRelativePath = rootName + "/" + relativePath;
                let list = this.mRelativeFilePaths.get(rootRelativePath);
                if (!list) {
                    list = [];
                    this.mRelativeFilePaths.set(rootRelativePath, list);
                }
                list.push(fsPath);
            }
        }
    }

    //删除文件缓存
    private removeFileCache(fsPath: string) {
        fsPath = Util.getInstance().getRightSlashPath(fsPath);
        if (this.mFiles.has(fsPath)) {
            this.mFiles.delete(fsPath);
        }

        let fileName = Util.getInstance().getFileName(fsPath);
        let list = this.mRelativeFilePaths.get(fileName);
        if (list) {
            let idx = 0;
            while (idx < list.length) {
                if (list[idx] === fsPath) {
                    list.splice(idx, 1);
                    break;
                } else {
                    idx++;
                }
            }
        }

        let luaRoot = this.getLuaRoot();
        if (luaRoot) {
            let relativePath = fsPath.replace(luaRoot, '');
            let list = this.mRelativeFilePaths.get(relativePath);
            if (list) {
                let idx = 0;
                while (idx < list.length) {
                    let a = list[0];
                    let b = list[1];
                    if (list[idx] === fsPath) {
                        list.splice(idx, 1);
                        break;
                    } else {
                        idx++;
                    }
                }
            }
        }

    }

    //清除文件缓存
    private clearFileCache() {
        this.mFiles.clear();
        this.mRelativeFilePaths.clear();
    }

    //初始化文件列表
    public initFileList(func?: Function): void {
        this.clearFileCache();
        let debugPath = WorkspaceManager.getInstance().getExtensionUnityDebugPath();
        let files = Util.getInstance().readDir(debugPath);

        //强行添加unity调试文件的查询
        let unityDebugPattern: string|undefined = undefined;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let fileName = Util.getInstance().getFileName(file);
            if (!unityDebugPattern) {
                unityDebugPattern = "**/"+fileName;
            }else{
                unityDebugPattern = unityDebugPattern + ",**/" + fileName;
            }
        }

        let pattern;
        if (unityDebugPattern) {
            pattern = "{**/*.lua," + unityDebugPattern + "}";
        }else{
            pattern = "**/*.lua";
        }
        vscode.workspace.findFiles(pattern, undefined).then((uris: vscode.Uri[]) => {
            uris.forEach(uri => {
                this.addFileCache(uri);
            });
            if (func) {
                func();
            }
        });
    }

    //获取文件绝对路径
    public getFileFullPath(path: string): string | string[] | undefined {

        if (this.mFiles.has(path)) {
            //本来就是绝对路径
            return path;
        }

        let list = this.mRelativeFilePaths.get(path);
        if (list?.length === 1) {
            return list[0];
        }

        return list;
    }

    //获取全局配置
    public getGlobalConfig(): vscode.WorkspaceConfiguration {
        if (!this.mGlobalConfig) {
            this.mGlobalConfig = vscode.workspace.getConfiguration(EXTENSION_NAME);
        }
        return this.mGlobalConfig;
    }

    //获取工作区配置
    public getWorkspaceConfig(): vscode.WorkspaceConfiguration {
        if (this.mWorkSpaceConfig) {
            return this.mWorkSpaceConfig;
        }
        //取总工作区配置文件
        let wf = vscode.workspace.workspaceFile;
        if (!wf) {
            //或取第一个工作区配置文件
            let floders = vscode.workspace.workspaceFolders;
            if (floders) {
                wf = floders[0].uri;
            }
        }
        let cfg = vscode.workspace.getConfiguration(EXTENSION_NAME, wf);
        this.mWorkSpaceConfig = cfg;
        return cfg;
    }

    public getGlobalLocalData() {
        return this.mContext?.globalState;
    }

    public getWorkspaceLocalData() {
        return this.mContext?.globalState;
    }

    //获取lua根目录
    public getLuaRoot(): string | undefined {
        if (this.mLuaRoot !== undefined) {
            return this.mLuaRoot;
        }
        let luaRoot = this.getWorkspaceConfig().get<string>(CONFIG_NAME.luaRoot);
        if (luaRoot) {
            if (luaRoot.indexOf("${workspaceRoot}") !== -1) {
                const workspaceFolders = vscode.workspace.workspaceFolders || [];
                luaRoot = luaRoot.replace("${workspaceRoot}", workspaceFolders[0].uri.fsPath);
            }

            let lastChar = luaRoot.substring(luaRoot.length - 1, luaRoot.length);
            if (lastChar !== "/" && lastChar !== "\\") {
                luaRoot = luaRoot + "/";
            }

            luaRoot = Util.getInstance().getRightSlashPath(luaRoot);
            // luaRoot = path.normalize(luaRoot);
        }
        this.mLuaRoot = luaRoot;
        return luaRoot;
    }

    //获取lua根目录名
    public getLuaRootName(): string|undefined{
        if (this.mLuaRootName !== undefined) {
            return this.mLuaRootName;
        }

        var luaRoot = this.getLuaRoot();
        if (luaRoot) {
            var idx1 = luaRoot.length - 1;
            var idx2 = luaRoot.lastIndexOf("/", idx1 - 1);
            if (idx2 !== -1) {
                idx2++;
                this.mLuaRootName = luaRoot.substring(idx2, idx1);
            }
        }
        return this.mLuaRootName;
    }

    //获取本插件实例
    public getExtension(): vscode.Extension<any> | undefined {
        return this.mContext?.extension;
    }

    //获取本插件目录
    public getExtensionDir(): string | undefined {
        return this.getExtension()?.extensionPath;
    }

    //获取插件模板目录
    public getExtensionTemplatePath() {
        return this.getExtensionDir() + "/template/";
    }

    //获取插件lua调试器路径
    public getExtensionLuaDebugPath(): string {
        return this.getExtensionDir() + "/other/lua/";
    }

    //获取插件unity调试器路径
    public getExtensionUnityDebugPath(): string {
        return this.getExtensionDir() + "/other/cs/";
    }
}