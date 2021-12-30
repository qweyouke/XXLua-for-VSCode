//调试时变量显示在行尾
import * as vscode from 'vscode';
import { DebugUtil } from '../debugger/DebugUtil';

const LOCAL_EXP1 = /\w+/g;
const LOCAL_EXP2 = "[\(\[\.\:\w]";
const LOCAL_EXP3 = "[\.\:\w]";
const LOCAL_EXP4 = /[\"'].*[\"']/g;
const LOCAL_EXP5 = /--/g;
const LOCAL_EXP6 = /[\w\[\]\.]+/g;
const PARAM_EXP = /(?<=---@param\s+)\S+/;
const IS_NUMBER_REGEXP = /^\d+$/;

interface LineRange {
    lineNum: number
    startIdx: number
    endIdx: number
}

//查找本地
function findVar(lineNum: number, str: string, allValues: Map<string, LineRange>, isEnd: boolean): boolean {
    if (!str.match(LOCAL_EXP5)) {
        str = str.replace(LOCAL_EXP4, "");

        if (isEnd) {
            var match = str.matchAll(LOCAL_EXP6);
            if (match) {
                for (const iterator of match) {
                    const varName = iterator[0];
                    if (!DebugUtil.getInstance().isFilterStr(varName) && !IS_NUMBER_REGEXP.test(varName) && !str.match(new RegExp(varName + LOCAL_EXP2))) {
                        allValues.set(varName, {
                            lineNum: lineNum,
                            startIdx: iterator.index ?? 0,
                            endIdx: (iterator.index ?? 0) + varName.length
                        });
                    }
                }
                return true;
            }
        } else {
            var match = str.matchAll(LOCAL_EXP1);
            if (match) {
                for (const iterator of match) {
                    const varName = iterator[0];
                    if (!DebugUtil.getInstance().isFilterStr(varName) && !str.match(new RegExp(varName + LOCAL_EXP2)) && !str.match(new RegExp(LOCAL_EXP3 + varName))) {
                        allValues.set(varName, {
                            lineNum: lineNum,
                            startIdx: iterator.index ?? 0,
                            endIdx: (iterator.index ?? 0) + varName.length
                        });
                    }
                }
                return true;
            }
        }
    }

    return false;
}

//查找参数
function findParamVar(lineNum: number, str: string, allValues: Map<string, LineRange>, isEnd: boolean): boolean {
    const match = PARAM_EXP.exec(str);
    if (match) {
        const varName = match[0];
        allValues.set(varName, {
            lineNum: lineNum,
            startIdx: match.index,
            endIdx: match.index + varName.length
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
    const allValues = new Map<string, LineRange>();
    const endLine = context.stoppedLocation.end.line
    for (let l = viewPort.start.line; l <= endLine; l++) {
        const str = document.lineAt(l).text;
        for (const key in handlerFuncList) {
            const func = handlerFuncList[key];
            if (func(l, str, allValues, l === endLine)) {
                break;
            }
        }
    }

    let ret: vscode.InlineValue[] = [];
    for (const [varName, lineRange] of allValues) {
        const varRange = new vscode.Range(lineRange.lineNum, lineRange.startIdx, lineRange.lineNum, lineRange.endIdx);
        if (lineRange.lineNum === endLine) {
            ret.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
        } else {
            ret.push(new vscode.InlineValueVariableLookup(varRange, varName));
        }
    }

    return ret;
}

export function init(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerInlineValuesProvider('lua', {
        provideInlineValues: provideInlineValues
    }));
}
