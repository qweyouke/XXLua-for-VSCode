//代码补全
import * as vscode from 'vscode';
import { Util } from "../util/Util";
import { WorkspaceManager } from "../util/WorkspaceManager";
import { CONFIG_NAME } from '../util/Define';

const CompletionItemKind = new Map<string, vscode.CompletionItemKind>();
CompletionItemKind.set("Text", vscode.CompletionItemKind.Text);
CompletionItemKind.set("Method", vscode.CompletionItemKind.Method);
CompletionItemKind.set("Function", vscode.CompletionItemKind.Function);
CompletionItemKind.set("Constructor", vscode.CompletionItemKind.Constructor);
CompletionItemKind.set("Field", vscode.CompletionItemKind.Field);
CompletionItemKind.set("Variable", vscode.CompletionItemKind.Variable);
CompletionItemKind.set("Class", vscode.CompletionItemKind.Class);
CompletionItemKind.set("Interface", vscode.CompletionItemKind.Interface);
CompletionItemKind.set("Module", vscode.CompletionItemKind.Module);
CompletionItemKind.set("Property", vscode.CompletionItemKind.Property);
CompletionItemKind.set("Unit", vscode.CompletionItemKind.Unit);
CompletionItemKind.set("Value", vscode.CompletionItemKind.Value);
CompletionItemKind.set("Enum", vscode.CompletionItemKind.Enum);
CompletionItemKind.set("Keyword", vscode.CompletionItemKind.Keyword);
CompletionItemKind.set("Snippet", vscode.CompletionItemKind.Snippet);
CompletionItemKind.set("Color", vscode.CompletionItemKind.Color);
CompletionItemKind.set("Reference", vscode.CompletionItemKind.Reference);
CompletionItemKind.set("File", vscode.CompletionItemKind.File);
CompletionItemKind.set("Folder", vscode.CompletionItemKind.Folder);
CompletionItemKind.set("EnumMember", vscode.CompletionItemKind.EnumMember);
CompletionItemKind.set("Constant", vscode.CompletionItemKind.Constant);
CompletionItemKind.set("Struct", vscode.CompletionItemKind.Struct);
CompletionItemKind.set("Event", vscode.CompletionItemKind.Event);
CompletionItemKind.set("Operator", vscode.CompletionItemKind.Operator);
CompletionItemKind.set("TypeParameter", vscode.CompletionItemKind.TypeParameter);
CompletionItemKind.set("User", vscode.CompletionItemKind.User);
CompletionItemKind.set("Issue", vscode.CompletionItemKind.Issue);

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
const SNIPPETS_FILE = "snippets_custom.json";



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
            } else {
                str = str.replace(new RegExp("{className}", 'gm'), Util.getInstance().getFileName(document.fileName, true));
            }
        }
        return str;
    };

    let chipStr = formatString(config.description);
    let kind = CompletionItemKind.get(config.type);
    let item = new vscode.CompletionItem(chipStr, kind);
    item.sortText = config.sort;
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


let providers:vscode.Disposable[] = [];
export function init(context: vscode.ExtensionContext) {
    const initSnippet = () => {
        providers.forEach(provider => {
            let idx = context.subscriptions.indexOf(provider);
            if (idx !== -1) {
                context.subscriptions.splice(idx, 1);
                provider.dispose();
            }
        });
        providers = [];
        let snippetConfig = JSON.parse(Util.getInstance().readFile(WorkspaceManager.getInstance().getExtensionDir() + "\\snippets\\" + SNIPPETS_FILE));

        let sort = 1;
        for (const key in snippetConfig) {
            const config = snippetConfig[key];
            config.sort = sort.toString();
            sort++;
            
            let provider = vscode.languages.registerCompletionItemProvider('lua', {
                provideCompletionItems: function (document, position, token, context) {
                    return doCompletion(document, config);
                },
                resolveCompletionItem
            }, config.prefix);

            providers.push(provider);
            context.subscriptions.push(provider);
        }
    };
    vscode.workspace.onDidSaveTextDocument((text: vscode.TextDocument) => {
        let fileName = Util.getInstance().getFileName(text.fileName);
        if (fileName === SNIPPETS_FILE) {
            initSnippet();
        }
    });
    initSnippet();
}
