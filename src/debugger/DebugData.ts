/* eslint-disable @typescript-eslint/naming-convention */
import { DebugProtocol } from "vscode-debugprotocol";


export interface IRequestArguments {
	name: string;
    type: string;
    request: string;
    clientHost: string;
    port: number;
    printType: number;
    externalVariables: string[];
    filterFiles: string[];
    localRoot: string;
}


export interface IAttachRequestArguments extends IRequestArguments, DebugProtocol.AttachRequestArguments {

}

export interface ILaunchRequestArguments extends IRequestArguments, DebugProtocol.LaunchRequestArguments {
    
}

export class BreakInfo{
    //全路径
    public fullPath: string;
    //行数
    public line: number;
    //条件
    public condition: string | undefined;
    //命中断点x次后才会真正进入断点
    public hitCondition: string | undefined;
    //日志
    public logMessage: string | undefined;
    constructor(fullPath: string, line: number, condition?: string, hitCondition?: string, logMessage?: string) {
        this.fullPath = fullPath;
        this.line = line;
        this.condition = condition;
        this.hitCondition = hitCondition;
        this.logMessage = logMessage;
    }
}

//堆栈数据
export interface StackTrack {
    fileName: string,
    filePath: string,
    currentline: number,
    functionName: string
}

//客户端变量结构
export interface ClientVariableStruct{
    type: string,
    var: any
}

//变量数据
export interface VariableData {
    //table地址
    tbkey: string
    //变量
    vars: DebugProtocol.Variable | DebugProtocol.Variable[]
}

export interface VariablePathData{
    //table地址
    tbkey: string,
    //变量名
    varKey?: string | undefined
}

//网络消息 获取变量域 Client to Debugger
export interface CMD_C2D_GetScopes{
    frameId: number,
    //初始结构 tbkey
    struct: {
        locals: string
        ups: string
        global: string
        watch: string
        invalid: string
    }
}

//网络消息 获取变量 Client to Debugger
export interface CMD_C2D_GetVariable{
    //请求路径
    path?: string
    //
    frameId?: number
    //真实路径 用于取不知道是哪个变量域的变量时，补全后的真实路径
    realPath: string
    //table地址
    tbkey: string
    //变量数据
    vars: ClientVariableStruct
}

//网络消息 监视变量 Client to Debugger
export interface CMD_C2D_WatchVariable {
    //表达式
    exp: string
    //返回数据
    vars: ClientVariableStruct
    //
    realPath: string
    //table地址
    tbkey: string
}

//事件 获取全路径名 Debugger to Provider
export interface Event_D2P_GetFullPath{
    filePath: string,
    idx: number
}

//事件 获取全路径名 Provider to Debugger
export interface Event_P2D_GetFullPath{
    fullPath: string,
    idx: number
}

export enum ErrorDefine{
    Error_1000 = 1000,
    Error_1001,
    Error_1002,
}