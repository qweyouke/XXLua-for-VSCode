//调试时变量显示在行尾
import * as vscode from 'vscode';
import { DebugUtil } from '../debugger/DebugUtil';

const LOCAL_EXP1 = /\w+/g;
const LOCAL_EXP2 = "[\(\[\.\:\w]";
const LOCAL_EXP3 = "[\.\:\w]";
const LOCAL_EXP4 = /[\"'].*?[\"']/g;
const LOCAL_EXP5 = /--/g;
const LOCAL_EXP6 = /[\w\[\]\.]+/g;
const PARAM_EXP = /(?<=---@param\s+)\S+/;
const IS_NUMBER_REGEXP = /^\d+$/;

interface LineRange {
    lineNum: number
    startIdx: number
    endIdx: number
    varName: string
}

//查找本地
function findVar(lineNum: number, str: string, uniqueValues: Map<string, LineRange>, nonUniqueValues: LineRange[], isEnd: boolean): boolean {
    if (!str.match(LOCAL_EXP5)) {
        str = str.replace(LOCAL_EXP4, "");
        
        if (isEnd) {
            var match = str.matchAll(LOCAL_EXP6);
            if (match) {
                for (const iterator of match) {
                    const varName = iterator[0];
                    if (!DebugUtil.getInstance().isFilterStr(varName) && !IS_NUMBER_REGEXP.test(varName) && !str.match(new RegExp(varName + LOCAL_EXP2))) {
                        uniqueValues.set(varName, {
                            lineNum: lineNum,
                            startIdx: iterator.index ?? 0,
                            endIdx: (iterator.index ?? 0) + varName.length,
                            varName: varName
                        });
                    }
                }
                return true;
            }
        } else {
            var isFindLocal = str.indexOf("local") !== -1 ? true : false;
            var isFindFunction = str.indexOf("function") !== -1 ? true : false;
            var equalIdx = str.indexOf("=");

            var match = str.matchAll(LOCAL_EXP1);
            if (match) {
                for (const iterator of match) {
                    const varName = iterator[0];
                    if (!DebugUtil.getInstance().isFilterStr(varName) && !str.match(new RegExp(varName + LOCAL_EXP2)) && !str.match(new RegExp(LOCAL_EXP3 + varName))) {
                        var value = {
                            lineNum: lineNum,
                            startIdx: iterator.index ?? 0,
                            endIdx: (iterator.index ?? 0) + varName.length,
                            varName: varName
                        };
                        if (isFindFunction || (isFindLocal && equalIdx !== -1 && str.indexOf(varName) < equalIdx)) {
                            nonUniqueValues.push(value);
                        } else {
                            uniqueValues.set(varName, value);
                        }
                    }
                }
                return true;
            }
        }
    }

    return false;
}

//查找参数
function findParamVar(lineNum: number, str: string, uniqueValues: Map<string, LineRange>, nonUniqueValues: LineRange[], isEnd: boolean): boolean {
    const match = PARAM_EXP.exec(str);
    if (match) {
        const varName = match[0];
        nonUniqueValues.push({
            lineNum: lineNum,
            startIdx: match.index,
            endIdx: match.index + varName.length,
            varName: varName
        });
        return true;
    }
    return false;
}

const handlerFuncList = [
    findVar,
    findParamVar
];

function provideInlineValues(document: vscode.TextDocument, viewPort: vscode.Range, context: vscode.InlineValueContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlineValue[]> {
    //唯一值 以变量名为key
    const uniqueValues = new Map<string, LineRange>();
    //非唯一值
    const nonUniqueValues: LineRange[] = [];
    const endLine = context.stoppedLocation.end.line;
    for (let l = viewPort.start.line; l <= endLine; l++) {
        const str = document.lineAt(l).text;
        for (const key in handlerFuncList) {
            const func = handlerFuncList[key];
            if (func(l, str, uniqueValues, nonUniqueValues, l === endLine)) {
                break;
            }
        }
    }

    let ret: vscode.InlineValue[] = [];
    for (const [varName, lineRange] of uniqueValues) {
        const varRange = new vscode.Range(lineRange.lineNum, lineRange.startIdx, lineRange.lineNum, lineRange.endIdx);
        if (lineRange.lineNum === endLine) {
            ret.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
        } else {
            ret.push(new vscode.InlineValueVariableLookup(varRange, varName));
        }
    }
    for (const key in nonUniqueValues) {
        const lineRange = nonUniqueValues[key];
        const varRange = new vscode.Range(lineRange.lineNum, lineRange.startIdx, lineRange.lineNum, lineRange.endIdx);
        ret.push(new vscode.InlineValueVariableLookup(varRange, lineRange.varName));
    }

    return ret;
}

export function init(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerInlineValuesProvider('lua', {
        provideInlineValues: provideInlineValues
    }));
}
