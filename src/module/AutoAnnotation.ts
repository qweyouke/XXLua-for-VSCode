//函数注释定义
import * as vscode from 'vscode';
import { LANGUAGE_ID } from "../util/Define";

let activeEditor: vscode.TextEditor;

//文本修改
function onDidChangeTextDocument(event:vscode.TextDocumentChangeEvent) {
    if (activeEditor && activeEditor.document === event.document && activeEditor.document.languageId === LANGUAGE_ID) {
    }
}

//打开文件
function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
    if (editor && editor.document.languageId === LANGUAGE_ID) {
        activeEditor = editor;
    }
}

function provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken):any{
    const fileName = document.fileName;
    const word = document.getText(range);
    // if (/\/package\.json$/.test(fileName) && /\bmain\b/.test(word)) {
        return [new vscode.CodeAction("测试快速修复", vscode.CodeActionKind.QuickFix)];
    // }
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument, null, context.subscriptions));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor, null, context.subscriptions));
    vscode.languages.registerCodeActionsProvider("lua",{provideCodeActions : provideCodeActions});
}
