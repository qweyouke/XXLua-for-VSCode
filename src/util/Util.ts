//工具类
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from "child_process";
import { WorkspaceManager } from './WorkspaceManager';


export class Util {
    private static _util: Util;
    public static getInstance() {
        if (!Util._util) {
            Util._util = new Util();
        }
        return Util._util;
    }

    //文件名缓存
    private mFileNameCache: Map<string, string>;

    constructor() {
        this.mFileNameCache = new Map<string, string>();
    }

    //递归读取目录下的所有文件
    public readDir(dirPath: string, dirs: string[] = [], curDir: string = ""): string[] {
        dirPath = dirPath.replace(new RegExp("\\\\", 'gm'), "/");

        let lastChar = dirPath.substring(dirPath.length-1);
        if (lastChar !== "/") {
            dirPath = dirPath + "/";
        }
        let realPath = dirPath + curDir;
        let isRecursion = dirs === undefined ? false : true;
        dirs = dirs === undefined ? [] : dirs;
        let files = fs.readdirSync(realPath);
        files.forEach((itm, index) => {
            let stat = fs.statSync(realPath + itm);
            if (stat.isDirectory() && isRecursion) {
                //递归读取文件
                this.readDir(dirPath, dirs, curDir + itm + "/");
            } else {
                dirs.push(curDir + itm);
            }
        });
        return dirs;
    }

    //创建空文件
    public tryCreateFile(filePath: string, defaultContent: string = "") {
        if (fs.existsSync(filePath)) {
            return;
        }
        fs.writeFileSync(filePath, defaultContent);
    }

    //读文件
    public readFile(filePath: string) {
        let data = fs.readFileSync(filePath, 'utf-8');
        return data;
    }

    //写文件
    public writeFile(filePath: string, content: string) {
        fs.writeFileSync(filePath, content);
    }

    //拷贝目录
    public copyDir(from: string, to: string) {
        const fromPath = path.resolve(from);
        const toPath = path.resolve(to);
        try {
            fs.statSync(toPath);
        } catch (error) {
            fs.mkdirSync(toPath);
        }
        fs.readdir(fromPath, (err, paths) => {
            if (err) {
                console.log(err);
                return;
            }
            paths.forEach((item) => {
                const newFromPath = fromPath + '/' + item;
                const newToPath = path.resolve(toPath + '/' + item);

                fs.stat(newFromPath, (err, stat) => {
                    if (err) { return; }
                    if (stat.isFile()) {
                        fs.copyFileSync(newFromPath, newToPath);
                    }
                    if (stat.isDirectory()) {
                        this.copyDir(newFromPath, newToPath);
                    }
                });
            });
        });
    }

    //复制文件/目录
    public copy(from: string, to: string) {
        const fromPath = path.resolve(from);
        const toPath = path.resolve(to);

        const dir = this.getDirPath(toPath);
        try {
            fs.statSync(dir);
        } catch (error) {
            fs.mkdirSync(dir);
        }

        fs.stat(fromPath, (err, stat) => {
            if (err) { return; }
            if (stat.isFile()) {
                fs.copyFileSync(fromPath, toPath);
            }
            if (stat.isDirectory()) {
                this.copyDir(fromPath, toPath);
            }
        });
    }

    //获取文件名+后缀
    public getFileName(filePath: string, isIgnoreSuffix: boolean = false): string {
        filePath = this.getRightSlashPath(filePath);

        if (this.mFileNameCache.has(filePath + isIgnoreSuffix)) {
            let fileName = this.mFileNameCache.get(filePath);
            if (fileName) {
                return fileName;
            }
        }

        
        let idx = filePath.lastIndexOf("/") + 1;
        let fileName = filePath.substring(idx, filePath.length);
        if (isIgnoreSuffix) {
            let idx = fileName.indexOf(".");
            if (idx !== -1) { 
                fileName = fileName.substring(0, idx);
            }
        }
        this.mFileNameCache.set(filePath + isIgnoreSuffix, fileName);
        return fileName;
    }

    //获取右斜线路径
    public getRightSlashPath(path: string) {
        return path.replace(/\\\\/g, "/").replace(/\\/g, "/");
    }

    //路径解析成require("")的lua路径 
    public parseToLuaPath(fsPath: string) {
        let luaRoot = WorkspaceManager.getInstance().getLuaRoot();

        let luaRoot2;
        if (!luaRoot) {
            vscode.window.showWarningMessage("请先配置Lua项目根目录");
            return undefined;
        } else {
            luaRoot = path.normalize(luaRoot);
            if (luaRoot.slice(luaRoot.length - 1, luaRoot.length) !== "\\") {
                luaRoot = luaRoot + "\\";
            }
            luaRoot2 = luaRoot.toLowerCase();
        }

        const len = luaRoot.length;
        let path2 = fsPath.toLowerCase();
        let ret = undefined;
        if (path2.indexOf(luaRoot2) !== -1) {
            ret = fsPath.slice(len, fsPath.length);
            ret = ret.slice(0, ret.indexOf(".")).replace(/\\/g, ".");
        } else {
            vscode.window.showWarningMessage("该文件不在Lua项目目录中");
            return undefined;
        }
        return ret;
    }


    //获取日期
    public formatDate() {
        const datetime = new Date();
        // 获取年月日时分秒值  slice(-2)过滤掉大于10日期前面的0
        var year = datetime.getFullYear(),
            month = ("0" + (datetime.getMonth() + 1)).slice(-2),
            date = ("0" + datetime.getDate()).slice(-2),
            hour = ("0" + datetime.getHours()).slice(-2),
            minute = ("0" + datetime.getMinutes()).slice(-2),
            second = ("0" + datetime.getSeconds()).slice(-2);
        // 拼接
        var result = year + "-" + month + "-" + date + " " + hour + ":" + minute + ":" + second;
        // 返回
        return result;
    }

    //在Finder中打开某个文件或者路径
    public openFileInFinder(filePath: string) {
        filePath = filePath.replace(new RegExp("\\\\", 'gm'), "/");
        if (!fs.existsSync(filePath)) {
            console.log('文件不存在：' + filePath);
        }
        // 如果是目录，直接打开就好
        if (fs.statSync(filePath).isDirectory()) {
            child_process.exec(`start ${filePath}`);
        } else {
            // 如果是文件，要分开处理
            const fileName = path.basename(filePath);
            filePath = path.dirname(filePath);
            // 这里有待完善，还不知道如何finder中如何选中文件
            child_process.exec(`start ${filePath}`);
        }
    }

    //在VSCode中打开某文件
    public openFileInVscode(path: string, text: string | undefined = undefined) {
        let options = undefined;
        if (text) {
            // const selection = this.getStrRangeInFile(path, text);
            // options = { selection };
        }
        vscode.window.showTextDocument(vscode.Uri.file(path), options);
    }

    //获取文件夹路径
    public getDirPath(fsPath: string): string{
        fsPath = this.getRightSlashPath(fsPath);
        var dir = undefined;

        try {
            if (fs.statSync(fsPath).isDirectory()) {
                dir = fsPath;
            } else {
                const idx = fsPath.lastIndexOf("/");
                dir = fsPath.substring(0, idx);
            }
        } catch (error) {
            const idx = fsPath.lastIndexOf("/");
            dir = fsPath.substring(0, idx);
        }
        
        return dir;
    }


        //打开导入调试文件弹窗
    public showOpenDialog(msg: string, func: (retPath: string | undefined) => void) {
        let defaultPath = WorkspaceManager.getInstance().getLuaRoot();
        let option: vscode.OpenDialogOptions = { // 可选对象
            canSelectFiles: false, // 是否可选文件
            canSelectFolders: true, // 是否可选文件夹
            canSelectMany: false, // 是否可以选择多个
            openLabel: msg
        };
        if (defaultPath) {
            option.defaultUri = vscode.Uri.file(defaultPath);
        }
        vscode.window.showOpenDialog(option).then((uris: vscode.Uri[] | undefined) => {
            if (uris) {
                func(uris[0].fsPath);
            } else {
                func(undefined);
            }
        });
    }

    public isPathExist(path: string) {
        let ret;
        try {
            fs.statSync(path);
            ret = true;
        } catch (error) {
            ret = false;
        }
        return ret;
    }
}