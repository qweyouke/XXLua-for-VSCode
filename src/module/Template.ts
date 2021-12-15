//创建模板
import { statSync } from 'fs';
import * as vscode from 'vscode';
import { Util } from "../util/Util";
import { WorkspaceManager } from "../util/WorkspaceManager";
import { CONFIG_NAME } from '../util/Define';

function showInputBox(title: string, func: ((selectStr: string | undefined) => void) | undefined = undefined) {
    vscode.window.showInputBox({
        placeHolder: title,
    }).then(func);
}

function checkTemplateFolder() {
    let cfg = WorkspaceManager.getInstance().getGlobalConfig();
    let path = cfg.get(CONFIG_NAME.templateFolder);
    if (!path) {
        vscode.window.showWarningMessage("没找到模板目录，点击确定导入模板", '确定')
        .then( (select) => {
            if (select === "确定") {
                Util.getInstance().showOpenDialog("导入", (importPath: string | undefined) => {
                    if (importPath) {
                        let idx = importPath.lastIndexOf("\\");
                        if (idx !== -1) {
                            let lastPath = importPath.substring(idx + 1, importPath.length);
                            if (lastPath !== "Template") {
                                importPath = importPath + "\\Template\\";
                            }
                        }

                        let from = WorkspaceManager.getInstance().getExtensionTemplatePath();
                        Util.getInstance().copyDir(from, importPath);
                        Util.getInstance().openFileInFinder(importPath);
                        cfg.update(CONFIG_NAME.templateFolder, importPath);
                    }
                });
            }
        });
        return false;
    }
    return true;
}

function createTemplate(uri: vscode.Uri) {
    if (checkTemplateFolder()) {
        const templatePath = WorkspaceManager.getInstance().getGlobalConfig().get<string>(CONFIG_NAME.templateFolder);
        if (!templatePath) {
            return;
        }
        const templates = Util.getInstance().readDir(templatePath);
        vscode.window.showQuickPick(
            templates, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: '请选择模板'
            }).then(function(selectFileName) {
            if (!selectFileName) {
                return;
            }

            let surfix = "";
            const idx = selectFileName.lastIndexOf(".");
            if (idx !== -1) {
                surfix = selectFileName.substring(idx, selectFileName.length);
            }

            showInputBox("请输入文件名",
                function(fileName: string | undefined) {
                    const config = WorkspaceManager.getInstance().getWorkspaceConfig();
                    const createFile = (className: string | undefined) => {
                        let data = Util.getInstance().readFile(templatePath + selectFileName);
                        data = data.replace(/{moduleName}/g, className || "undefined");
                        data = data.replace(/{time}/g, Util.getInstance().formatDate());

                        let defaultArgs: string[] | undefined = config.get(CONFIG_NAME.templateDefaultArgs);
                        if (defaultArgs) {
                            for (const key in defaultArgs) {
                                if (Object.prototype.hasOwnProperty.call(defaultArgs, key)) {
                                    const value = defaultArgs[key];
                                    let pattern = "{" + key + "}";
                                    data = data.replace(new RegExp(pattern, "g"), value);
                                }
                            }
                        }

                        let doCreate = () => {
                            var dir = Util.getInstance().getDirPath(uri.fsPath);
                            const filePath = dir + "\\" + fileName + surfix;
                            Util.getInstance().writeFile(filePath, data);
                            Util.getInstance().openFileInVscode(filePath);
                        };

                        let match = data.match(/({otherArg\d+})/g);
                        if (match) {
                            let otherArgs:string[] = [];
                            for (const item of match) {
                                let str = item.toString();
                                if (otherArgs.indexOf(str) === -1) {
                                    otherArgs.push(str);
                                }
                            }
                            let index = 0;
                            let inputOtherArgs = () => {
                                let key = otherArgs[index];
                                showInputBox("请输入" + key,
                                    (value: string | undefined) => {
                                        data = data.replace(new RegExp(key, "g"), value || "undefined");
                                        index++;
                                        if (index === otherArgs.length) {
                                            doCreate();
                                        } else {
                                            inputOtherArgs();
                                        }
                                    }
                                );
                            };
                            inputOtherArgs();
                        } else {
                            doCreate();
                        }

                    };

                    const isInputClassName = config.get(CONFIG_NAME.isInputClassName);
                    if (isInputClassName) {
                        showInputBox("请输入类名", createFile);
                    } else {
                        createFile(fileName);
                    }
                }
            );
        });
    }
}

function openTemplateFloder() {
    if (checkTemplateFolder()) {
        const templatePath = WorkspaceManager.getInstance().getGlobalConfig().get<string>(CONFIG_NAME.templateFolder);
        if (!templatePath) {
            return;
        }
        Util.getInstance().openFileInFinder(templatePath);
    }
}


export function init(context: vscode.ExtensionContext){
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.createTemplate', createTemplate));
    context.subscriptions.push(vscode.commands.registerCommand('XXLua.openTemplateFloder', openTemplateFloder));
}
