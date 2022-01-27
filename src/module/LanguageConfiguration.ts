//语法额外规则配置
import * as vscode from 'vscode';
import { LanguageConfiguration, IndentAction } from "vscode";
import { LANGUAGE_ID } from "../util/Define";

class LuaLanguageConfiguration implements LanguageConfiguration {
    //自动添加"---""
    public onEnterRules = [
        {
			action: { indentAction: IndentAction.None, appendText: "---" },
			beforeText: /^---/,
        }
    ];

    public wordPattern = /((?<=')[^']+(?='))|((?<=")[^"]+(?="))|(-?\d*\.\d\w*)|([^\`\~\!\@\$\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g;
}

export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.languages.setLanguageConfiguration(LANGUAGE_ID, new LuaLanguageConfiguration()));
}