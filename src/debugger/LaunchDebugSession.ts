//Launch调试器
import { DebugSession } from './DebugSession';
import { ILaunchRequestArguments } from './DebugData';
import { DebugProtocol } from 'vscode-debugprotocol';

export class LaunchDebugSession extends DebugSession {
    launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments, request?: DebugProtocol.Request) {
        this.createServer(response, args);
    }
}