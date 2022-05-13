//语法额外规则配置
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { LANGUAGE_ID } from "../util/Define";
import * as path from "path";

export class LSP implements vscode.Disposable {
    private static _instance: LSP;
    public static getInstance() {
        if (!LSP._instance) {
            LSP._instance = new LSP();
        }
        return LSP._instance;
    }

    private mContext: vscode.ExtensionContext | undefined;
    private mClient: LanguageClient | undefined;

    public init(context: vscode.ExtensionContext) {
        this.mContext = context;
    }

    constructor() {
        
    }
    
    dispose() {
        this.mClient?.stop();
    }

    async doStartServer() {
        if (!this.mContext) {
            return;
        }
        const serverModule = this.mContext.asAbsolutePath(
            path.join('server', 'out', 'server.js')
        );

        //服务端调试配置
        //服务器的调试选项
        //——inspect=6009:在Node的Inspector模式下运行服务器，这样VS Code就可以连接到服务器上进行调试
        const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
        
        //服务端配置
        //如果扩展在调试模式下启动，那么调试服务器选项被使用
        //否则使用运行选项
        const serverOptions: ServerOptions = {
            run: { module: serverModule, transport: TransportKind.ipc },
            debug: {
                module: serverModule,
                transport: TransportKind.ipc,
                options: debugOptions
            }
        };

        //客户端配置
        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: LANGUAGE_ID }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.lua')
            }
        };

        //创建客户端
        let client = new LanguageClient(
            LANGUAGE_ID,
            'XXLua Server',
            serverOptions,
            clientOptions
        );
        
        this.mClient = client;

        //启动客户端。这也将启动服务器
        client.start();

        await client.onReady();

        console.log("xxlua server started");
    }
}