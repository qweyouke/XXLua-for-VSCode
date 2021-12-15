//调试时变量显示在行尾
import * as vscode from 'vscode';

function findLocalVar(lineNum: number, str: string, allValues: vscode.InlineValue[]): boolean {
    const regExp = /(?<=local\s+).+?(?==|\n)/;
    const match = regExp.exec(str);
    if (match) {
        let array = match[0].replace(/\s/g, "").split(",");
        
        for (const key in array) {
            if (Object.prototype.hasOwnProperty.call(array, key)) {
                const varName = array[key];
                const varRange = new vscode.Range(lineNum, match.index, lineNum, match.index + varName.length);
                allValues.push(new vscode.InlineValueVariableLookup(varRange, varName, false));
            }
        }

        return true;
    }
    return false;
}

function findParamVar(lineNum: number, str: string, allValues: vscode.InlineValue[]): boolean
{
    const regExp = /(?<=---@param\s+)\S+/;
    const match = regExp.exec(str);
    if (match) {   
        const varName = match[0];
        const varRange = new vscode.Range(lineNum, match.index, lineNum, match.index + varName.length);
        allValues.push(new vscode.InlineValueVariableLookup(varRange, varName, false));
        return true;
    }
    return false;
}

const handlerFuncList = [
    findLocalVar,
    findParamVar
];
        
function provideInlineValues(document: vscode.TextDocument, viewPort: vscode.Range, context: vscode.InlineValueContext, token: vscode.CancellationToken):vscode.ProviderResult<vscode.InlineValue[]>
{
    const allValues:vscode.InlineValue[] = [];
    for (let l = viewPort.start.line; l <= context.stoppedLocation.end.line; l++) {
        const str = document.lineAt(l).text;
        for (const key in handlerFuncList) {
            if (Object.prototype.hasOwnProperty.call(handlerFuncList, key)) {
                const func = handlerFuncList[key];
                if (func(l, str, allValues)) {
                    break;
                }
            }
        }
    }
    return allValues;
}
        
export function init(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerInlineValuesProvider('lua', {
        provideInlineValues: provideInlineValues
    }));
}
