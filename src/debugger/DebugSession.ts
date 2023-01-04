//调试器基类
import { LoggingDebugSession } from 'vscode-debugadapter';
import { BreakInfo, IRequestArguments, CMD_C2D_GetScopes, StackTrack, Event_D2P_GetFullPath, Event_P2D_GetFullPath, CMD_C2D_GetVariable, CMD_C2D_WatchVariable, ErrorDefine, VariableData } from './DebugData';
import { DebugUtil, PrintType } from './DebugUtil';
import { ScopeData, TABLE } from './ScopeData';
import * as Proto from './Proto';

import * as net from 'net';
import * as vscode_debugadapter from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as readline from 'readline';
import * as path from 'path';

//ref:method() ref.method()
const WATCH_REGEXP1 = /\w+\s*\((\w|\s)*\)/;
//#table
const WATCH_REGEXP2 = /^\s*#\w+/;
//equ表达式、加减乘除
const WATCH_REGEXP3 = /^.+(<|>|<=|>=|==|~=|\+|\-|\*|\/|<<|>>).+/;
//tb[*]
const WATCH_REGEXP4 = /.+?\[.+?\]/;

const HOVER_SPLIT_REGEXP = /\w+/g;
const HOVER_IS_NUMBER_REGEXP = /^\d+$/;
const HOVER_IS_STRING_REGEXP = /^\"/;

export class DebugSession extends LoggingDebugSession {
    //断点数据
    private mBreakPoints: { [_: string]: BreakInfo[] };
    //服务器
    private mServer: net.Server | undefined;
    //调试socket
    private mDebugSocket: net.Socket | undefined;
    //辅助socket
    protected mSupportSocket: net.Socket | undefined;
    //lua根目录
    private mLuaRoot: string | undefined;
    //连接索引
    private mClientIndex: number;
    //是否已初始化
    private mIsInited: boolean;
    //初始化定时器
    private mInitTimer: NodeJS.Timer | undefined;
    //堆栈数据
    private mStackTracks: StackTrack[] | undefined;
    //变量域数据
    private mScopeDatas: ScopeData[];
    //调试初始化数据
    protected mDebugData: IRequestArguments | undefined;
    //当前frame id
    private mFrameId: number;
    //当前堆栈 id 每次进入断点+1
    private mStackId: number;

    //构造函数
    constructor() {
        super(...arguments);

        this.mBreakPoints = {};
        this.mServer = undefined;
        this.mDebugSocket = undefined;
        this.mSupportSocket = undefined;
        this.mClientIndex = 0;
        this.mIsInited = false;
        this.mInitTimer = undefined;
        this.mStackTracks = undefined;
        this.mScopeDatas = [];
        this.mLuaRoot = undefined;
        this.mFrameId = 0;
        this.mStackId = 0;

        process.on('uncaughtException', (err) => { this.printConsole("process.uncaughtException:" + "\n" + err.stack, PrintType.error); }); //监听未捕获的异常
        process.on('unhandledRejection', (err, promise) => { this.printConsole("process.unhandledRejection:" + err, PrintType.error); }); //监听Promise没有被捕获的失败函数
    }

    //显示弹窗消息
    private showDialogMessage(msg: string, type: PrintType) {
        this.sendEvent(new vscode_debugadapter.Event(Proto.EVENT.showDialogMessage, { msg: msg, type: type }));
    }

    //打印日志
    public printConsole(msg: string, type = PrintType.normal) {
        if (msg !== undefined) {
            msg = "[" + DebugUtil.getInstance().getNowTimeStr() + "]: " + msg + "\n";
            this.sendEvent(new vscode_debugadapter.OutputEvent(msg, DebugUtil.getInstance().getPrintTypeStr(type)));
        }
    }

    //初始化堆栈
    private initStackTrack() {
        // this.printConsole("initDebugData")
        this.mStackTracks = undefined;
        this.mScopeDatas = [];
        this.mFrameId = 0;
        this.mStackId++;
    }

    //初始化变量域
    private initScope(frameId: number, data: CMD_C2D_GetScopes) {
        // this.printConsole("------------------")
        // this.printConsole("initScope");
        // this.printConsole("frameId: " + frameId);
        // this.printConsole("data: " + JSON.stringify(data));
        // this.printConsole("------------------")
        let scopeData = new ScopeData(data, this);
        this.mScopeDatas[frameId] = scopeData;
        this.setFrameId(frameId);
        return scopeData;
    }

    //设置当前变量域Id
    private setFrameId(id: number) {
        this.mFrameId = id;
    }

    //region 调试服务器-----------------------------------------------------------------------------------

    //准备发送初始化消息到客户端
    private readySendInit() {
        if (this.mIsInited) {
            return;
        }
        if (this.mInitTimer) {
            clearTimeout(this.mInitTimer);
        }
        this.mInitTimer = setTimeout(() => {
            this.mInitTimer = undefined;
            this.mIsInited = true;
            this.sendSupportMessage(Proto.CMD.initialize, this.mDebugData);
            this.sendDebugMessage(Proto.CMD.initialize);
        }, 200);
    }

    //创建调试服务器
    protected async createServer(response: DebugProtocol.Response, args: IRequestArguments) {
        // this.printConsole("createServer");
        // this.printConsole("args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------");

        await new Promise((resolve, reject) => {
            this.mDebugData = args;
            if (this.mDebugData.clientHost === "localhost") {
                this.mDebugData.clientHost = "127.0.0.1";
            }
            if (this.mLuaRoot) {
                this.mDebugData.localRoot = this.mLuaRoot;
            }


            // this.printConsole("attachRequest:" + JSON.stringify(this.initData))

            setTimeout(
                () => {
                    const server = net.createServer(client => {
                        this.onConnect(client);
                    })
                        .listen(args.port)
                        .on('listening', () => {
                            this.printConsole(`The debugger(${DebugUtil.getInstance().getIPAdress()}:${args.port}) is ready, wait for client's connection...`);
                            this.onCreateServerSuccess();
                        })
                        .on('error', err => {
                            this.printConsole('server error, stop debugger', 2);
                            response.success = false;
                            response.message = `${err}`;
                            this.sendResponse(response);
                        });
                    this.mServer = server;
                    this.sendResponse(response);
                },
                1000
            );
        });
    }

    //创建服务器成功
    protected onCreateServerSuccess() {

    }

    //与客户端连接成功
    private onConnect(client: net.Socket) {
        if (this.mClientIndex === 0) {
            this.mIsInited = false;

            if (this.mSupportSocket !== undefined) {
                this.onSupportSocketClose();
            }

            // this.print("SupportClient Connected.")
            this.mSupportSocket = client;

            client.on('end', () => this.onSupportSocketClose())
                .on('close', hadErr => this.onSupportSocketClose())
                .on('error', err => this.onSupportSocketClose());


            this.sendEvent(new vscode_debugadapter.InitializedEvent());
            this.readySendInit();

            this.mClientIndex = 1;
        } else if (this.mClientIndex === 1) {
            if (this.mDebugSocket !== undefined) {
                this.onDebugSocketClose();
            }

            // this.print("Client Connected.")
            this.mDebugSocket = client;

            client.on('end', () => this.onSupportSocketClose())
                .on('close', hadErr => this.onDebugSocketClose())
                .on('error', err => this.onDebugSocketClose());
            this.mClientIndex = 0;
        }


        readline.createInterface({
            input: client,
            output: client
        }).on("line", line => this.onReceiveLine(line));
    }

    //调试socket关闭
    private onDebugSocketClose() {
        this.initStackTrack();
        this.printConsole('Debug socket disconnected.');
        if (this.mDebugSocket) {
            this.mDebugSocket.removeAllListeners();
            this.mDebugSocket.end();
            this.mDebugSocket = undefined;
        }
    }

    //辅助socket关闭
    private onSupportSocketClose() {
        // this.printConsole('Support socket disconnected.');
        if (this.mSupportSocket) {
            this.mSupportSocket.removeAllListeners();
            this.mSupportSocket.end();
            this.mSupportSocket = undefined;
        }
    }

    //from调试进程 断开连接
    disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request) {
        this.initStackTrack();
        // this.printConsole('Debugger disconnected.');
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")

        this.sendSupportMessage(Proto.CMD.stop, args);
        setTimeout(() => {
            // if (this.socket) {
            //     this.socket.close();
            //     this.socket = undefined;
            // }
            if (this.mDebugSocket !== undefined) {
                this.onDebugSocketClose();
            }
            if (this.mSupportSocket !== undefined) {
                this.onSupportSocketClose();
            }
        }, 200);
        this.sendResponse(response);
    }

    //添加一个安全事件，将对堆栈id进行检测，检测不通过则无回调
    //返回真实监听回调， 用作外部自定义移除
    addSafeEvent(eventName: string, isOnce: boolean, func: (args: any) => void, errorFunc: (() => void) | undefined = undefined) {
        let stackId = this.mStackId;
        let listener = (retArgs: any) => {
            if (!this.mStackTracks || this.mStackId !== stackId) {
                // this.printConsole("addSafeEvent return : " + eventName);
                this.removeListener(eventName, listener);
                if (errorFunc) {
                    errorFunc();
                }
                return;
            }
            func(retArgs);

            if (isOnce) {
                this.removeListener(eventName, listener);
            }
        };
        this.on(eventName, listener);
        return listener;
    }

    //发送调试socket消息
    sendDebugMessage(cmd: string, args?: any) {
        // this.print("------------------------------------------");
        // this.print("sendDebugMessage:\n    cmd:" + cmd + "\n       args:" + JSON.stringify(args));
        // this.print("------------------------------------------");

        if (this.mDebugSocket) {
            let msg = {
                command: cmd,
                args: args || ""
            };
            this.mDebugSocket.write(`${JSON.stringify(msg)}\n`);
        }
    }

    //发送辅助socket消息
    sendSupportMessage(cmd: string, args: any) {
        // this.print("------------------------------------------");
        // this.print("sendSupportMessage:\n    cmd:" + cmd + "\n       args:" + JSON.stringify(args));
        // this.print("------------------------------------------");

        if (this.mSupportSocket) {
            let msg = {
                command: cmd,
                args: args || ""
            };
            this.mSupportSocket.write(`${JSON.stringify(msg)}\n`);
        }
    }

    //发送断点信息
    sendBreakpoints(breaks: { [_: string]: BreakInfo[] }) {
        breaks = breaks || this.mBreakPoints;
        let args = {
            breakPoints: breaks,
        };

        this.sendDebugMessage(Proto.CMD.setBreakpoints, args);
        this.sendSupportMessage(Proto.CMD.setBreakpoints, args);
    }

    //接收数据
    onReceiveLine(input: string) {
        const data = JSON.parse(input);
        const cmd = data.command;
        const args = data.arguments;
        if (cmd === Proto.CMD.printConsole) {
            this.printConsole(args.msg, args.type);
        } else {
            // this.printConsole("onReceiveLine: " + line)
            if (cmd === Proto.CMD.pause) {
                this.onReceivePause(args);
            } else if (cmd === Proto.CMD.showDialogMessage) {
                this.showDialogMessage(args.msg, args.type);
            } else if (cmd === Proto.CMD.resetStackInfo) {
                this.initStackTrack();
            } else if (cmd === Proto.CMD.getScopes) {
                this.emit(Proto.CMD.getScopes + args.frameId, args);
            } else if (cmd === Proto.CMD.getVariable) {
                this.emit(Proto.CMD.getVariable + args.frameId + args.path, args);
            } else if (cmd === Proto.CMD.watchVariable) {
                this.emit(Proto.CMD.watchVariable + args.frameId + args.exp, args);
            }
            else {
                this.emit(cmd, args);
            }
        }

    }

    //接收到暂停
    onReceivePause(args: any) {
        this.mStackTracks = args;
        this.sendEvent(new vscode_debugadapter.StoppedEvent("breakpoint", 1));
    }

    //跨进程事件接收
    customRequest(command: string, response: DebugProtocol.Response, args: any, request?: DebugProtocol.Request) {
        // this.printConsole("customRequest cmd:" + command)
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")

        if (command === Proto.CMD.printConsole) {
            // 1正常 2警告 3错误
            // args.type
            this.printConsole(args.msg, args.type);
        } else if (command === Proto.EVENT.reloadLua) {
            if (this.mSupportSocket) {
                this.sendSupportMessage(Proto.CMD.reloadLua, { luaPath: args.luaPath, fullPath: args.fullPath });
            } else {
                this.showDialogMessage("重载失败，调试器未连接到客户端", 2);
            }
        } else {
            this.emit(command, args);
        }
    }

    //endregion


    //region 调试器事件-----------------------------------------------------------------------------

    //from调试进程 初始化调试请求(启动调试器)
    async initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments) {
        // this.printConsole("initializeRequest");
        // this.printConsole("args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------");

        await new Promise((resolve, reject) => {
            const onInitDebugEnv = (data: any) => {
                this.removeListener(Proto.EVENT.initDebugEnv, onInitDebugEnv);

                this.mLuaRoot = data.luaRoot;
                response.body = response.body || {};
                response.body.supportsFunctionBreakpoints = true;
                response.body.supportsConditionalBreakpoints = true;
                response.body.supportsHitConditionalBreakpoints = true;
                response.body.supportsLogPoints = true;
                response.body.supportsEvaluateForHovers = true;
                this.sendResponse(response);
            };
            this.on(Proto.EVENT.initDebugEnv, onInitDebugEnv);
            this.sendEvent(new vscode_debugadapter.Event(Proto.EVENT.initDebugEnv));
        });
    }

    //from调试进程 断点变化
    setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request) {
        const source = args.source;

        // this.printConsole("setBreakPointsRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")

        if (source && source.path) {

            let filePath = path.normalize(source.path).replace(/\\/g, "/");
            const bps = args.breakpoints || [];
            const bpsProto: BreakInfo[] = [];
            const bpsResp = [];
            for (let i = 0; i < bps.length; i++) {
                const bp = bps[i];
                bpsProto.push(new BreakInfo(
                    filePath,
                    bp.line,
                    bp.condition,
                    bp.hitCondition,
                    bp.logMessage
                ));

                const bpResp = new vscode_debugadapter.Breakpoint(true, bp.line);
                bpsResp.push(bpResp);
            }


            let idx = filePath.lastIndexOf("/") + 1;
            let pointIdx = filePath.lastIndexOf(".");
            if (pointIdx === -1) {
                pointIdx = filePath.length;
            }

            let shortFilePath = filePath.substring(idx, pointIdx);
            let cache = this.mBreakPoints[shortFilePath];
            if (cache) {
                let idx = 0;
                while (idx < cache.length) {
                    if (cache[idx].fullPath === filePath) {
                        cache.splice(idx, 1);
                    } else {
                        idx++;
                    }
                }
                bpsProto.forEach(element => {
                    if (cache) {
                        cache.push(element);
                    }
                });
            } else {
                this.mBreakPoints[shortFilePath] = bpsProto;
                cache = bpsProto;
            }
            response.body = { breakpoints: bpsResp };

            this.sendBreakpoints(
                { [shortFilePath]: cache }
            );

            this.readySendInit();
        }

        this.sendResponse(response);
    }

    //from调试进程
    threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request) {
        response.body = {
            threads: [
                new vscode_debugadapter.Thread(1, "thread 1")
            ]
        };
        this.sendResponse(response);
    }



    //from调试进程 堆栈分析(发起暂停，开始调试)
    async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request) {
        // this.printConsole("stackTraceRequest");
        // this.printConsole("args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------");

        if (!this.mStackTracks) {
            return;
        }

        let stacks = this.mStackTracks;

        await new Promise((resolve, reject) => {
            const stackFrames: vscode_debugadapter.StackFrame[] = [];

            let listener = this.addSafeEvent(Proto.EVENT.getFullPath,
                false,
                (data: Event_P2D_GetFullPath) => {
                    var fullPath = data.fullPath;
                    var idx = data.idx;
                    var stack = stacks[idx];
                    let source = new vscode_debugadapter.Source(stack.fileName, fullPath);
                    stackFrames.push(new vscode_debugadapter.StackFrame(idx, stack.functionName, source, stack.currentline));

                    if (idx === stacks.length - 1) {
                        this.removeListener(Proto.EVENT.getFullPath, listener);
                        response.body = {
                            stackFrames: stackFrames,
                            totalFrames: stackFrames.length
                        };
                        this.sendResponse(response);
                    }
                },
                () => {
                    this.sendResponse(response);
                }
            );

            for (let i = 0; i < stacks.length; i++) {
                const stack = stacks[i];
                this.sendEvent(new vscode_debugadapter.Event(Proto.EVENT.getFullPath, { filePath: stack.filePath, idx: i }));
            }
        });
    }

    //from调试进程 作用域分析(选中某个堆栈)
    async scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request) {
        // this.printConsole("scopesRequest");
        // this.printConsole("args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------");
        if (!this.mStackTracks) {
            // this.sendResponse(response);
            return;
        }

        let handler = (scopeData: ScopeData) => {
            response.body = {
                scopes: [{
                    name: "Local",
                    variablesReference: scopeData.localsStartRefID,
                    expensive: false
                },
                {
                    name: "Ups",
                    variablesReference: scopeData.upsStartRefID,
                    expensive: false
                },
                {
                    name: "Global",
                    variablesReference: scopeData.globalStartRefID,
                    expensive: false
                },
                    // {
                    //     name: "Invalid",
                    //     variablesReference: scopeData.invalidStartRefID,
                    //     expensive: false
                    // },
                    // {
                    //     name: "Watch",
                    //     variablesReference: scopeData.watchStartRefID,
                    //     expensive: false
                    // },
                ]
            };

            this.sendResponse(response);
            this.emit(Proto.EVENT.onReceiveScopes, args.frameId);
        };

        let scopeData = this.mScopeDatas[args.frameId];
        if (scopeData) {
            handler(scopeData);
        } else {
            await new Promise((resolve, reject) => {
                let frameId = args.frameId;
                this.sendDebugMessage(Proto.CMD.getScopes, { frameId: frameId });

                this.addSafeEvent(Proto.CMD.getScopes + frameId, true,
                    (data: CMD_C2D_GetScopes) => {
                        handler(this.initScope(frameId, data));
                    },
                    () => {
                        this.sendResponse(response);
                    }
                );
            });
        }
    }

    //from调试进程 变量请求
    async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
        // this.printConsole("variablesRequest args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------")

        const sendExpiredResponse = () => {
            response.body = {
                variables: [{
                    name: "error",
                    type: "object",
                    value: "Expired value",
                    variablesReference: 0
                }]
            };
            this.sendResponse(response);
        };

        if (!this.mStackTracks) {
            sendExpiredResponse();
            return;
        }

        const frameId = this.mFrameId;
        const scopeData = this.mScopeDatas[frameId];
        if (!scopeData) {
            sendExpiredResponse();
            return;
        }

        const tbkey = scopeData.getTbkey(args.variablesReference);
        if (!tbkey) {
            response.body = {
                variables: [{
                    name: "error",
                    type: "object",
                    value: "error! not find tbkey",
                    variablesReference: 0
                }]
            };
            this.sendResponse(response);
            return;
        }

        if (scopeData.isLoadedFullTable(tbkey)) {
            // this.printConsole("variablesRequest from cache");
            const vars = scopeData.getTableVarByRefId(args.variablesReference);
            // this.printConsole(tbkey + ":" + JSON.stringify(vars));
            if (vars && vars.length > 0) {
                response.body = {
                    variables: vars,
                };
            } else {
                response.body = {
                    variables: [{
                        name: "{}",
                        value: "",
                        variablesReference: 0,
                        presentationHint: { kind: "property" },
                    }]
                };
            }

            this.sendResponse(response);
        } else {
            const path = scopeData.getPathByRefId(args.variablesReference);
            if (!path) {
                response.body = {
                    variables: [{
                        name: "error",
                        type: "error",
                        value: "error! not find path",
                        variablesReference: 0
                    }]
                };
                this.sendResponse(response);
                return;
            }
            await new Promise((resolve, reject) => {
                // this.printConsole("variablesRequest getVariable   id:" + args.variablesReference + " path:" + path);
                this.sendDebugMessage(Proto.CMD.getVariable, { frameId: frameId, path: path });

                this.addSafeEvent(Proto.CMD.getVariable + frameId + path, true,
                    (data: CMD_C2D_GetVariable) => {
                        if (this.mFrameId !== frameId) {
                            this.sendResponse(response);
                            return;
                        }

                        const varData = scopeData.loadVariables(data);
                        const vars = varData.vars;
                        if (vars instanceof Array) {
                            if (vars.length > 0) {
                                response.body = {
                                    variables: vars,
                                };
                            } else {
                                response.body = {
                                    variables: [{
                                        name: "{}",
                                        value: "",
                                        variablesReference: 0,
                                        presentationHint: { kind: "property" },
                                    }]
                                };
                            }
                        } else {
                            response.body = {
                                variables: [vars]
                            };
                        }

                        this.sendResponse(response);
                    },
                    sendExpiredResponse
                );
            });
        }
    }



    //from调试进程 评估请求(鼠标悬浮到文字上、监视)
    async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments, request?: DebugProtocol.Request) {
        // this.printConsole("evaluateRequest args:" + JSON.stringify(args));
        // this.printConsole("-----------------------------------------");

        if (args.frameId === undefined) {
            this.printConsole("evaluateRequest not find frameId", PrintType.error);
            return;
        }

        const sendExpiredResponse = () => {
            response.body = {
                result: "Expired value",
                type: "object",
                variablesReference: 0,
                presentationHint: { kind: "property" }
            };
            this.sendResponse(response);
        };

        const scopeData = this.mScopeDatas[args.frameId];
        if (!scopeData) {
            if (this.mStackTracks) {
                // this.printConsole("register onReceiveScopes");
                //用于监视变量时，scopeData获取次序不对的情况
                await new Promise((resolve, reject) => {
                    this.addSafeEvent(Proto.EVENT.onReceiveScopes, true,
                        (frameId) => {
                            // this.printConsole("resend evaluateRequest");
                            if (frameId !== args.frameId) {
                                this.sendResponse(response);
                                return;
                            }
                            this.evaluateRequest(response, args);
                        }, sendExpiredResponse);
                });
            } else {
                sendExpiredResponse();
            }
            return;
        }

        this.setFrameId(args.frameId);

        const showEvaluateVariables = (varData: VariableData) => {
            const vars = varData.vars;
            const tbkey = varData.tbkey;
            if (vars instanceof Array) {
                if (scopeData.isLoadedFullTable(tbkey)) {
                    const refID = scopeData.getRefID(tbkey);
                    if (refID) {
                        response.body = {
                            result: tbkey,
                            variablesReference: refID,
                        };
                        this.sendResponse(response);
                        return true;
                    } else {
                        this.printConsole("Error " + ErrorDefine.Error_1000, PrintType.error);
                    }
                }
            } else {
                response.body = {
                    result: vars.value,
                    type: vars.type,
                    variablesReference: 0,
                    presentationHint: { kind: "property" }
                };
                this.sendResponse(response);
                return true;
            }
        };

        if (args.context === "watch" && (WATCH_REGEXP1.test(args.expression) || WATCH_REGEXP2.test(args.expression)) || WATCH_REGEXP3.test(args.expression) || WATCH_REGEXP4.test(args.expression)) {
            //来自监视并且是lua算法表达式

            //先读缓存
            const varData = scopeData.getVariableByPath(args.expression);
            if (varData && showEvaluateVariables(varData)) {
                // this.printConsole("evaluateRequest[watch] from cache table, refId:" + scopeData.getRefID(varData.tbkey));
                return;
            }

            this.sendDebugMessage(Proto.CMD.watchVariable, { frameId: args.frameId, exp: args.expression });
            this.addSafeEvent(Proto.CMD.watchVariable + args.frameId + args.expression, true,
                (data: CMD_C2D_WatchVariable) => {
                    if (this.mFrameId !== args.frameId) {
                        sendExpiredResponse();
                        return;
                    }

                    let variable = {
                        realPath: data.realPath,
                        tbkey: data.tbkey,
                        vars: data.vars
                    };

                    const varData = scopeData.loadVariables(variable);
                    showEvaluateVariables(varData);
                },
                sendExpiredResponse
            );
        } else {

            //过滤特殊字符
            let path: string | undefined = args.expression;

            let isNumber = HOVER_IS_NUMBER_REGEXP.test(path);
            let isString = HOVER_IS_STRING_REGEXP.test(path);
            if (isNumber || isString || DebugUtil.getInstance().isFilterStr(path)) {
                let type;
                if (isNumber) {
                    type = "number";
                } else if (isString) {
                    path = path + "\"";
                    type = "string";
                } else {
                    type = "object";
                }
                response.body = {
                    result: path,
                    type: type,
                    variablesReference: 0,
                    presentationHint: { kind: "property" }
                };
                this.sendResponse(response);
                return;
            }

            let match = path.matchAll(HOVER_SPLIT_REGEXP);
            path = undefined;
            for (const iterator of match) {
                if (!path) {
                    path = iterator[0];
                } else {
                    path = path + "-" + iterator[0];
                }
            }
            // this.printConsole("evaluateRequest path:" + path);

            if (!path) {
                response.body = {
                    result: "Not find path, origin expression is:" + args.expression,
                    type: "object",
                    variablesReference: 0,
                    presentationHint: { kind: "property" }
                };
                this.sendResponse(response);
                return;
            }

            //先读缓存
            const varData = scopeData.getVariableByPath(path);
            if (varData && showEvaluateVariables(varData)) {
                // this.printConsole("evaluateRequest from cache table, refId:" + scopeData.getRefID(varData.tbkey));
                return;
            }

            await new Promise((resolve, reject) => {
                // this.printConsole("evaluateRequest getVariable  " + " path:" + path);
                this.sendDebugMessage(Proto.CMD.getVariable, { frameId: args.frameId, path: path });

                this.addSafeEvent(Proto.CMD.getVariable + args.frameId + path, true,
                    (data: CMD_C2D_GetVariable) => {
                        if (this.mFrameId !== args.frameId) {
                            sendExpiredResponse();
                            return;
                        }

                        const varData = scopeData.loadVariables(data);
                        showEvaluateVariables(varData);
                    }, sendExpiredResponse
                );
            });
        }

    }

    //from调试进程 暂停
    pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request) {
        // this.printConsole("pauseRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")

        this.sendDebugMessage(Proto.CMD.pause);
        this.sendResponse(response);
    }

    //from调试进程 继续
    continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request) {
        // this.printConsole("continueRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")
        this.initStackTrack();

        this.sendDebugMessage(Proto.CMD.continue);
        this.sendResponse(response);
    }

    //from调试进程 单步跳过
    nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request) {
        // this.printConsole("nextRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")
        this.initStackTrack();

        this.sendDebugMessage(Proto.CMD.next);
        this.sendResponse(response);
    }

    //from调试进程 单步跳入
    stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request) {
        // this.printConsole("stepInRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")
        this.initStackTrack();

        this.sendDebugMessage(Proto.CMD.stepIn);
        this.sendResponse(response);
    }

    //from调试进程 单步跳出
    stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request) {
        // this.printConsole("stepOutRequest")
        // this.printConsole("args:" + JSON.stringify(args))
        // this.printConsole("-----------------------------------------")
        this.initStackTrack();

        this.sendDebugMessage(Proto.CMD.stepOut);
        this.sendResponse(response);
    }

    //endregion
}