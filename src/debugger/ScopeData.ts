//变量域数据类
//des: tbkey(lua table地址)
import { DebugSession } from "./DebugSession";
import { DebugProtocol } from 'vscode-debugprotocol';
import { Handles } from 'vscode-debugadapter';
import { CMD_C2D_GetScopes, CMD_C2D_GetVariable, VariableData, VariablePathData } from './DebugData';
export var TABLE = "table";

const REPLACE_EXTRA_REGEXP = /\s{1}\[.*?\]/;
const STRUCT_LIST = ["locals", "watch", "ups", "global", "invalid"];

export class ScopeData {
    core: DebugSession;
    data: CMD_C2D_GetScopes;
    //table唯一id <tbkey, id>
    private mTableRefIds: Map<string, number>;
    //变量路径 <path, pathData>
    private mLoadedPaths: Map<string, VariablePathData>;
    //变量<tbkey, <varKey, data>>
    private mLoadedVars: Map<string, DebugProtocol.Variable[]>;
    //是否已加载完整个table <tbkey, boolean>
    private mIsLoadedFullTables: Map<string, boolean>;

    private mHandles: Handles<string>;
    localsStartRefID: number;
    upsStartRefID: number;
    globalStartRefID: number;
    invalidStartRefID: number;
    watchStartRefID: number;



    constructor(data: CMD_C2D_GetScopes, core: DebugSession) {

        this.data = data;
        this.core = core;
        this.mTableRefIds = new Map<string, number>();
        this.mLoadedPaths = new Map<string, VariablePathData>();
        this.mLoadedVars = new Map<string, DebugProtocol.Variable[]>();
        this.mIsLoadedFullTables = new Map<string, boolean>();

        this.mHandles = new Handles();

        this.localsStartRefID = 0;
        this.upsStartRefID = 0;
        this.globalStartRefID = 0;
        this.invalidStartRefID = 0;
        this.watchStartRefID = 0;

        this.initStruct();
    }

    initStruct() {
        this.localsStartRefID = this.createRef(this.data.struct.locals);
        this.upsStartRefID = this.createRef(this.data.struct.ups);
        this.globalStartRefID = this.createRef(this.data.struct.global);
        this.invalidStartRefID = this.createRef(this.data.struct.invalid);
        this.watchStartRefID = this.createRef(this.data.struct.watch);

        this.addPath("locals", this.data.struct.locals);
        this.addPath("ups", this.data.struct.ups);
        this.addPath("global", this.data.struct.global);
        this.addPath("invalid", this.data.struct.invalid);
        this.addPath("watch", this.data.struct.watch);
    }

    //创建table唯一id
    createRef(tbkey: string) {
        let refId = this.mTableRefIds.get(tbkey);
        if (!refId) {
            refId = this.mHandles.create(tbkey);
            this.mTableRefIds.set(tbkey, refId);
        }

        return refId;
    }

    //获取table地址
    getTbkey(refID: number) {
        if (refID === undefined) {
            return undefined;
        }
        return this.mHandles.get(refID);
    }

    //添加路径数据
    addPath(path: string, tbkey: string, varKey: string | undefined = undefined) {
        if (!this.mLoadedPaths.has(path)) {
            this.mLoadedPaths.set(path, { tbkey: tbkey, varKey: varKey });
            // this.core.printConsole("addPath path:" + path + "   tbkey:" + tbkey + "   varKey:" + varKey);
        }
    }

    //通过table唯一id找路径
    getPathByRefId(refID: number) {
        const tbkey = this.getTbkey(refID);

        for (var [key, value] of this.mLoadedPaths) {
            if (value.tbkey === tbkey) {
                return key;
            }
        }
    }

    //获取table唯一id
    getRefID(tbkey: string) {
        return this.mTableRefIds.get(tbkey);
    }

    //是否已加载完整个table
    isLoadedFullTable(tbkey: string) {
        return this.mIsLoadedFullTables.get(tbkey);
    }

    //通过路径获取变量
    getVariableByPath(path: string): VariableData | undefined {
        let pathData: VariablePathData | undefined = undefined;
        
        if (STRUCT_LIST.indexOf(path) === -1) {
            pathData = this.mLoadedPaths.get(path);
        }
            
        if (!pathData) {
            //不是传的全路径， 则从全路径缓存中去找值
            for (const prefixKey of STRUCT_LIST) {
                pathData = this.mLoadedPaths.get(prefixKey + "-" + path);
                if (pathData) {
                    break;
                }
            }
        }
        if (pathData) {
            if (pathData.varKey) {
                let vars = this.mLoadedVars.get(pathData.tbkey);
                if (vars) {
                    for (const key in vars) {
                        const data = vars[key];
                        if (data.name === pathData.varKey) {
                            return { tbkey: pathData.tbkey, vars: data };
                        }
                    }
                }
            } else {
                let vars = this.mLoadedVars.get(pathData.tbkey);
                if (vars) {
                    return { tbkey: pathData.tbkey, vars: vars };
                }
            }
        }
    }

    //获取table变量
    getTableVar(tbkey: string) {
        return this.mLoadedVars.get(tbkey);
    }

    //获取table变量
    getTableVarByRefId(refID: number) {
        if (refID !== undefined) {
            const tbkey = this.getTbkey(refID);
            if (tbkey) {
                return this.mLoadedVars.get(tbkey);
            }
        }
    }

    //清除附加参数名
    private clearExternalKey(key: string) {
        return key.replace(REPLACE_EXTRA_REGEXP, "");
    }

    //加载变量
    loadVariables(data: CMD_C2D_GetVariable): VariableData {
        const tbkey = data.tbkey;
        const path = data.realPath;
        const refId = this.createRef(tbkey);
        const vars = data.vars;

        if (vars.type === TABLE) {
            this.addPath(path, tbkey);

            let variables: DebugProtocol.Variable[] = [];
            this.mLoadedVars.set(tbkey, variables);
            this.mIsLoadedFullTables.set(tbkey, true);

            let varList: string[] = [];
            for (const key in vars.var) {
                varList.push(key);
            }
            varList.sort();
            varList.forEach(key => {
                const value = vars.var[key];
                const varPath = path + "-" + this.clearExternalKey(key);
                if (value.type === TABLE) {
                    let newRefId = this.createRef(value.var);
                    
                    variables.push({
                        name: key,
                        type: "",
                        value: value.var,
                        variablesReference: newRefId
                    });
                    this.addPath(varPath, value.var);

                    // this.core.printConsole("create var: " + varPath + "     " + value.var + "     " + newRefId);
                } else {
                    variables.push({
                        name: key,
                        type: value.type,
                        value: value.type === "string" && "\"" + value.var + "\"" || value.var,
                        variablesReference: 0
                    });
                    this.addPath(varPath, tbkey, key);
                }
            });

            return { tbkey: tbkey, vars: variables };
        } else {
            let variables = this.getTableVarByRefId(refId);
            if (!variables) {
                variables = [];
                this.mLoadedVars.set(tbkey, variables);
            }

            let paths = path.split("-");
            const key = paths[paths.length - 1];

            let value = {
                name: key,
                type: vars.type,
                value: vars.type === "string" && "\"" + vars.var + "\"" || vars.var,
                variablesReference: 0
            };
            variables.push(value);

            this.addPath(path, tbkey, key);
            return { tbkey: tbkey, vars: value };
        }
    }
}
