//代码补全
import * as vscode from 'vscode';
import { Util } from "../util/Util";
import { WorkspaceManager } from "../util/WorkspaceManager";
import { CONFIG_NAME } from '../util/Define';

class ClassData{
    _name: string;
    _line: number;
    constructor(name: string,line: number){
        this._name = name;
        this._line = line;
    }
}

//类名缓存
const _classCache: Map<string, ClassData> = new Map<string, ClassData>();
const _classCacheTimer: Map<string, NodeJS.Timer> = new Map<string, NodeJS.Timer>();
const CLASS_VALID_TIME = 60;
const LOCAL_CHAR = "local ";



//获取class数据
function getClassData(document: vscode.TextDocument, isFouceGetNewData: boolean = false): ClassData | undefined {
    let cacheData = _classCache.get(document.uri.fsPath);
    if (!isFouceGetNewData && cacheData) {
        return cacheData;
    }

    const className:string[] | undefined = WorkspaceManager.getInstance().getWorkspaceConfig().get(CONFIG_NAME.classFuncName);
    if (className) {
        for (let i = 0; i < document.lineCount; i++) {
            let text = document.lineAt(i).text;
                //取类名
            for (let j = 0; j < className.length; j++) {
                let element = "= " + className[j];
                if (text.indexOf(element) === -1) {
                    element = "=" + element + "(\"";
                }
                if (text.indexOf(element) !== -1) {
                    let classIndex = text.indexOf(element);
                    if (classIndex !== -1) {
                        let startIdx = text.indexOf(LOCAL_CHAR);
                        if (startIdx === -1) {
                            startIdx = 0;
                        } else {
                            startIdx = startIdx + LOCAL_CHAR.length;
                        }

                        cacheData = new ClassData(text.slice(startIdx, classIndex).trim(), i);
                        _classCache.set(document.uri.fsPath, cacheData);


                        if (_classCacheTimer.has(document.uri.fsPath)) {
                            let timer = _classCacheTimer.get(document.uri.fsPath);
                            if (timer) {
                                clearInterval(timer);
                            }
                            _classCacheTimer.delete(document.uri.fsPath);
                        }
                        _classCacheTimer.set(document.uri.fsPath,setInterval(function() {
                            _classCache.delete(document.uri.fsPath);
                            _classCacheTimer.delete(document.uri.fsPath);
                        }, CLASS_VALID_TIME * 1000));

                        return cacheData;
                    }
                }
            }
        }
    }
    
}

function doCompletion(document: vscode.TextDocument, config: any) {
    const formatString = function(str: string) {
        if (str.indexOf("{className}") !== -1) {
            const classData = getClassData(document);
            if (classData) {
                str = str.replace(new RegExp("{className}", 'gm'), classData._name);
            }
        }
        return str;
    };


    let chipStr = formatString(config.description);
    let item = new vscode.CompletionItem(chipStr, vscode.CompletionItemKind.Function);
    item.detail = "[XXLua] " + config.prefix;
    item.documentation = new vscode.MarkdownString(chipStr + "\nend", false);
    item.insertText = new vscode.SnippetString(formatString(config.body));
    return [item];
}

/**
 * 光标选中当前自动补全item时触发动作，一般情况下无需处理
 * @param {*} item 
 * @param {*} token 
 */
function resolveCompletionItem(item: any, token: vscode.CancellationToken) {
    return null;
}


export function init(context: vscode.ExtensionContext){
    let snippetConfig = JSON.parse(Util.getInstance().readFile(WorkspaceManager.getInstance().getExtensionDir() + "\\snippets\\snippets_custom.json"));
    for (const key in snippetConfig) {
        const config = snippetConfig[key];
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
            provideCompletionItems: function(document, position, token, context) {
                return doCompletion(document, config);
            },
            resolveCompletionItem
        }, config.prefix));
    }
}
