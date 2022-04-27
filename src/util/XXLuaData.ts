//本地数据
import * as vscode from 'vscode';
import { Util } from './Util';

export class XXLuaData {
    //工作区本地数据
    private mWorkspaceData: any;
    private mFilePath: string | undefined;


    public init(path: string) {
        this.mFilePath = path;

        Util.getInstance().tryCreateFile(path, "{}");
        var str = Util.getInstance().readFile(path);
        this.mWorkspaceData = JSON.parse(str);
        var a = 0;
    }

    private save() {
        if (this.mFilePath) {
            var json = JSON.stringify(this.mWorkspaceData);
            Util.getInstance().writeFile(this.mFilePath, json);
        }
    }

    public update(key: string, value: any) {
        this.mWorkspaceData[key] = value;
        this.save();
    }

    public get(key: string, defaultValue: any = undefined) {
        return this.mWorkspaceData[key] || defaultValue;
    }

}