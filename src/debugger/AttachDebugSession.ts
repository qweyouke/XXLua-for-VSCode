//附加调试器
import { DebugSession } from './DebugSession';
import { IAttachRequestArguments } from './DebugData';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as net from 'net';

const ATTACH_TIME_OUT = 100;

export class AttachDebugSession extends DebugSession {
    attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments, request?: DebugProtocol.Request) {
        this.createServer(response, args);
    }

    //创建服务器成功
    override onCreateServerSuccess() {
        this.tryAttach();
    }

    //尝试主动连接客户端
    private async tryAttach(port:number | undefined = undefined) {
        if (this.mSupportSocket) {
            return;
        }

        if (!this.mDebugData) {
            return;
        }

        if (port === undefined) {
            port = this.mDebugData.port + 1;
        }

        if (port > this.mDebugData.port + 1000) {
            return;
        }

        // this.printConsole("tryAttack " + port);

        

        await new Promise((resolve, reject) => {
            if (!this.mDebugData) {
                return;
            }
            if (!port) {
                return;
            }

            var sock : net.Socket;
            sock = net.connect(
                {
                port: port,
                host: this.mDebugData.clientHost,
                timeout: ATTACH_TIME_OUT,
            }
            ).on('connect', () => {
                // if (this.mDebugData) {
                //     this.printConsole(`The debugger connecting to attach server(${this.mDebugData.clientHost}:${port}) successfully, wait for the attach server connect back to debugger`);
                // }
            
            }).on('error', error => {
                this.printConsole("Connecting to the attach server error!", 2);
                sock.destroy();
                
                if (!port) {
                    return;
                }
                this.tryAttach(port + 1);
            }).on('timeout', () => {
                // this.printConsole("Connecting to the attach server timeout!", 2);
                sock.destroy();
                
                if (!port) {
                    return;
                }
                this.tryAttach(port + 1);
            });
        });
    }
}