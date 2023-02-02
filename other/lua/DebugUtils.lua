---工具类
---anthor: xxiong
---@class Utils
local Utils = {}
local filePathCachePaths = {}
local compareStrCache = {}
local compareCache = {}
local CSHARP_BASE_VALUE = {
    ["System.Boolean"] = "boolean",
    ["System.Char"] = "string",
    ["System.String"] = "string",
    ["System.Int16"] = "number",
    ["System.Int32"] = "number",
    ["System.Int64"] = "number",
    ["System.IntPtr"] = "number",
    ["System.Byte"] = "number",
    ["System.Byte[]"] = "string",
    ["System.SByte"] = "number",
    ["System.UInt16"] = "number",
    ["System.UInt32"] = "number",
    ["System.UInt64"] = "number",
    ["System.UIntPtr"] = "number",
    ["System.Decimal"] = "number",
    ["System.Single"] = "number",
    ["System.Double"] = "number",
    ["Method"] = "function",
    ["null"] = "nil",
}
---@diagnostic disable-next-line: deprecated
local loadstring = loadstring or load

local setfenv = setfenv
if (not setfenv) then
    --lua5.1以上没有这个函数了
    setfenv = function(fn, env)
        local i = 1
        while true do
            local name = debug.getupvalue(fn, i)
            if name == "_ENV" then
                debug.upvaluejoin(
                    fn,
                    i,
                    (function()
                        return env
                    end),
                    1
                )
                break
            elseif Utils.isNil(name) then
                break
            end

            i = i + 1
        end

        return fn
    end
end

--参数合并table
local tablePack = table.pack or function(...)
    return { ... }
end

--table拆成参数
local tableUnpack = table.unpack or unpack

--table长度
local tableMaxKey = function(t)
    local count = 0
    for k, v in pairs(t) do
        if type(k) == "number" and k > count then
            count = k
        end
    end
    return count
end

---分割字符串
---@param text string 需要分割字符串
---@param sep string 匹配字符串，支持模式匹配
---@param plain boolean? 是否开启模式匹配，默认关闭，可省略
---@param base_zero boolean? 返回数组是否按照下标0位开始，默认下标1位开始，可省略
---@return string[]
local strSplit = function(text, sep, plain, base_zero)
    ---@type string[]
    local result = {}
    if (text and type(text) == type("")) then
        local searchPos = 1
        local idx = base_zero and 0 or 1
        while true do
            local matchStart, matchEnd = string.find(text, sep, searchPos, plain)
            if matchStart and matchEnd >= matchStart then
                -- insert string up to separator into result
                result[idx] = string.sub(text, searchPos, matchStart - 1)
                idx = idx + 1
                -- continue search after separator
                searchPos = matchEnd + 1
            else
                -- insert whole reminder as result
                result[idx] = string.sub(text, searchPos)
                break
            end
        end
    end

    return result
end

--获取table地址
function Utils.getTbKey(var)
    if type(var) == "userdata" and Utils.isLoadedLuaDebugTool() then
        return CS.LuaDebugTool.GetTbKey(var)
    else
        return tostring(var)
    end
end

--判空
function Utils.isNil(var)
    if var == nil then
        return true
    end

    if type(var) == "userdata" then
        --UntyEngine的Object判空不能直接判nil
        if var.IsNull ~= nil then
            return var:IsNull()
        else
            return nil
        end
    end

    return false
end

--是否是c#表
function Utils.isCSharpTable(var)
    local ret
    Utils.xpcall(function()
        ret = (type(var) == "userdata" and var.GetType and not CSHARP_BASE_VALUE[tostring(var:GetType())])
    end)
    return ret
end

--是否加载c#调试工具
function Utils.isLoadedLuaDebugTool()
    local tool = CS and CS.LuaDebugTool
    if tool then
        local ret
        xpcall(
            function()
                tool.GetTbKey("")
                ret = true
            end,
            function()
                ret = false
            end
        )
        return ret
    else
        return false
    end
end

--反向查找
function Utils.lastFind(str, k)
    local ts = string.reverse(str)
    local _, i = string.find(ts, k)
    if i then
        i = string.len(ts) - i + 1
        return i
    end
end

--获取路径详情
function Utils.getFilePathInfo(file)
    if filePathCachePaths[file] then
        return filePathCachePaths[file][1], filePathCachePaths[file][2], filePathCachePaths[file][3]
    end

    local fileName = nil

    file = file:gsub("/.\\", "/")
    file = file:gsub("\\", "/")
    file = file:gsub("//", "/")
    if file:find("@") == 1 then
        file = file:sub(2)
    end

    local findex = file:find("%./")
    if findex == 1 then
        file = file:sub(3)
    end

    -- file = file:gsub("%.", "/")

    local idx = Utils.lastFind(file, "/")
    if idx then
        fileName = file:sub(idx + 1, file:len())
    else
        fileName = file
    end

    local surfixName
    local pointIdx = fileName:find("%.")
    if pointIdx then
        surfixName = fileName:sub(pointIdx, file:len())
        fileName = fileName:sub(1, fileName:find("%.") - 1)
    else
        surfixName = ".lua"
        file = file .. surfixName
    end

    filePathCachePaths[file] = {
        file,
        fileName,
        surfixName
    }
    return file, fileName, surfixName
end

---@return {locals: table, localsIndex: table, ups: table, upsIndex: table, func: function}
local function getStackValue(f)
    local i = 1
    local locals = {}
    local localsIndex = {}
    -- get locals
    while true do
        local name, value = debug.getlocal(f, i)
        if Utils.isNil(name) then
            break
        end

        if name ~= "(*temporary)" then
            locals[name] = value
            localsIndex[name] = i
        end

        i = i + 1
    end

    local func = debug.getinfo(f, "f").func
    i = 1
    local ups = {}
    local upsIndex = {}
    while func do -- check for func as it may be nil for tail calls
        local name, value = debug.getupvalue(func, i)
        if Utils.isNil(name) then
            break
        end

        if name == "_ENV" then
            ups["_ENV_"] = value
            upsIndex["_ENV_"] = i
        else
            ups[name] = value
            upsIndex[name] = i
        end

        i = i + 1
    end

    return { locals = locals, localsIndex = localsIndex, ups = ups, upsIndex = upsIndex, func = func }
end

--获取堆栈
---@return StackInfo[]
function Utils.getStackInfo(ignoreCount, isFindVar)
    local ret = {}
    for i = ignoreCount, 100 do
        local source = debug.getinfo(i)
        if Utils.isNil(source) then
            break
        end

        local file = source.source

        if file ~= "=[C]" and file ~= "[C]" then
            local filePath, fileName, surfixName = Utils.getFilePathInfo(file)
            local info = {
                fileName = fileName,
                filePath = filePath,
                currentline = source.currentline,
                linedefined = source.linedefined,
                lastlinedefined = source.lastlinedefined,
                functionName = source.name,
                func = source.func
            }
            if isFindVar then
                info.vars = getStackValue(i + 1)
            end

            table.insert(ret, info)
        end

        if source.what == "main" then
            break
        end
    end

    -- dump(ret, "stackInfo", 3)
    return ret
end

---加载变量域
---@return ScopeInfo
function Utils.loadScopes()
    local scopeData = {
        struct = {}
    }
    local stackInfo = LuaDebug:getCurrentStackInfo()[LuaDebug:getCurrentFrameId() + 1].vars
    stackInfo.global = _G
    stackInfo.invalid = {}
    stackInfo.watch = {}

    for k, v in pairs(stackInfo) do
        scopeData.struct[k] = tostring(v)
    end

    return scopeData
end

--解析c#对象为VariableData
---@param csharpVar userdata
---@return table<string, VariableData>
function Utils.ParseCSharpValue(csharpVar)

    local varInfos = {}
    if Utils.isLoadedLuaDebugTool() then

        ---@param field CSharp_ValueInfo
        local function createCSharpVariable(field)
            local type = CSHARP_BASE_VALUE[field._valueType]
            if type then
                varInfos[field._key] = { type = type, var = field._valueStr }
            else
                varInfos[field._key] = { type = "table", var = Utils.getTbKey(field._value) }
            end
        end

        if csharpVar then
            ---@type CSharp_ValueInfo
            local fields = CS.LuaDebugTool.ParseCSharpValue(csharpVar)

            ---@diagnostic disable-next-line: undefined-field
            for i = 1, fields.Count do
                local field = fields[i - 1]
                createCSharpVariable(field)
            end
        end

    else
        varInfos = Utils.createVariable("读取C#变量失败，请确定LuaDebugTool.cs文件在项目工程中并启动")
    end

    -- dump(varInfos, "GetCSharpValue", 3)

    return varInfos
end

local DisableDelChars = {
    [string.byte("\n")] = true,
    [string.byte("\t")] = true,
}

--过滤特殊不可见字符
function Utils.filterSpecChar(s)
    local ss = {}
    local k = 1
    while true do
        if k > #s then
            break
        end

        local c = string.byte(s, k)
        if Utils.isNil(c) then
            break
        end

        xpcall(
            function()
                if c < 192 then
                    if (c >= 32 and c <= 126) or DisableDelChars[c] then
                        table.insert(ss, string.char(c))
                    else
                        table.insert(ss, "?")
                    end

                    k = k + 1
                elseif c < 224 then
                    local c1 = string.byte(s, k + 1)
                    table.insert(ss, string.char(c, c1))
                    k = k + 2
                elseif c < 240 then
                    -- if c >= 228 and c <= 233 then
                    local c1 = string.byte(s, k + 1)
                    local c2 = string.byte(s, k + 2)
                    if c1 and c2 then
                        local a1, a2, a3, a4 = 128, 191, 128, 191
                        if c == 228 then
                            a1 = 184
                        elseif c == 233 then
                            a2, a4 = 190, c1 ~= 190 and 191 or 165
                        end

                        if c1 >= a1 and c1 <= a2 and c2 >= a3 and c2 <= a4 then
                            table.insert(ss, string.char(c, c1, c2))
                        else
                            table.insert(ss, "#")
                        end
                    end
                    -- end

                    k = k + 3
                elseif c < 248 then
                    k = k + 4
                elseif c < 252 then
                    k = k + 5
                elseif c < 254 then
                    k = k + 6
                else
                    k = k + 1
                end
            end,
            function(msg)
                table.insert(ss, "parse error: " .. msg)
            end
        )
    end

    return table.concat(ss)
end

---创建变量数据
---@param v any
---@return VariableData
function Utils.createVariable(v)
    if v == nil then
        return { type = "nil", var = "nil" }
    else
        local type = type(v)
        if type == "table" or Utils.isCSharpTable(v) then
            return { type = "table", var = Utils.getTbKey(v) }
        elseif type == "userdata" then
            ---@diagnostic disable-next-line: undefined-field
            return { type = v.GetType and (CSHARP_BASE_VALUE[tostring(v:GetType())] or "unknown") or "unknown",
                var = tostring(v) }
        elseif type == "string" then
            v = Utils.filterSpecChar(tostring(v))
            return { type = "string", var = v }
        else
            return { type = type, var = tostring(v) }
        end
    end
end

--安全获取table值
function Utils.rawget(tb, key)
    local ret
    xpcall(
        function()
            ret = tb[key]
        end,
        function()
            ret = rawget(tb, key)
        end
    )
    return ret
end

---安全获取table变量
---@param tb table
---@param key any
---@param isSearchSpecialKeyType boolean? 是否搜索特殊key类型(table、function...)
---@return any, type  --值、key类型
function Utils.safeGet(tb, key, isSearchSpecialKeyType)
    if tb == nil or key == nil then
        return nil
    end

    if type(tb) == "table" then
        --lua对象
        local ret = Utils.rawget(tb, key)
        if ret then
            return ret, type(key)
        end

        --key类型为number的情况 为了兼容C#的Array
        if Utils.isNil(ret) then
            local nKey = tonumber(key)
            if nKey then
                ret = Utils.rawget(tb, nKey)
                if ret then
                    return ret, "number"
                end
            end
        end

        --key类型为特殊类型(table、function...)的情况
        if Utils.isNil(ret) and isSearchSpecialKeyType and type(key) == "string" then
            for k, v in pairs(tb) do
                if tostring(k) == key then
                    return v, type(k)
                end
            end
        end
    elseif Utils.isLoadedLuaDebugTool() and Utils.isCSharpTable(tb) then
        --C#对象
        return CS.LuaDebugTool.GetCSharpValue(tb, key), type(key)
    end

    return nil
end

---安全设置table变量
function Utils.rawset(tb, key, value)
    xpcall(
        function()
            tb[key] = value
        end,
        function()
            rawset(tb, key, value)
        end
    )
end

---无法设置变量的类型。
local invalidValueTypeDict = {
    ["userdata"] = true,
    ["System.Byte"] = true,
    ["System.Byte[]"] = true,
    ["System.SByte"] = true,
    ["System.IntPtr"] = true,
    ["System.UIntPtr"] = true,
    ["System.Single"] = true,
    ["Method"] = true,
    ["null"] = true
}

--#region 变量操作----------------------------------
do
    --获取额外变量值
    local loadExtraVar
    loadExtraVar = function(var, tb)
        local debugData = LuaDebug:getDebugData()
        for i, v in ipairs(debugData.externalVariables) do
            local newVar = Utils.safeGet(var, v)
            if newVar then
                if type(newVar) == "table" then
                    for k2, v2 in pairs(newVar) do
                        if Utils.isNil(tb[k2]) then
                            tb[k2] = v2
                        end
                    end

                    loadExtraVar(newVar, tb)
                else
                    if Utils.isNil(tb[v]) then
                        tb[v] = newVar
                    end
                end
            end
        end
    end

    local function getVar(var, k)
        if Utils.isNil(var) then
            return nil
        end

        local v, keyType = Utils.safeGet(var, k, true)

        --查询扩展数据
        if Utils.isNil(v) then
            local tb = {}
            loadExtraVar(var, tb)
            v, keyType = Utils.safeGet(tb, k)
        end

        return v, keyType
    end

    ---查看额外变量
    ---@param ret table 存储表
    ---@param var table 目标表
    local function traverseExtraVars(ret, var)
        if type(ret) ~= "table" or type(var) ~= "table" then
            return
        end

        local cacheKeys = {}
        for k, v in pairs(ret) do
            cacheKeys[k] = true
        end

        local getExtraVars
        getExtraVars = function(tb, key, prefix)
            local newVar = Utils.safeGet(tb, key)
            if newVar then
                if type(newVar) == "table" then
                    for k, v in pairs(newVar) do
                        if Utils.isNil(cacheKeys[k]) then
                            local newKey
                            if prefix then
                                newKey = k .. " [" .. prefix .. "." .. key .. "]"
                            else
                                newKey = k .. " [" .. key .. "]"
                            end

                            cacheKeys[k] = true
                            ret[newKey] = Utils.createVariable(v)
                        end
                    end

                    getExtraVars(newVar, key, prefix and prefix .. "." .. key or key)
                elseif Utils.isNil(cacheKeys[key]) then
                    local newKey
                    if prefix then
                        newKey = key .. " [" .. prefix .. "." .. key .. "]"
                    else
                        newKey = key .. " [" .. key .. "]"
                    end

                    cacheKeys[key] = true
                    ret[newKey] = Utils.createVariable(newVar)
                end
            end
        end

        local debugData = LuaDebug:getDebugData()
        for _, key in ipairs(debugData.externalVariables) do
            getExtraVars(var, key)
        end
    end

    local function transformValue(upperTable, value, valueType)
        if valueType == "number" then
            value = tonumber(value)
        elseif valueType == "boolean" then
            value = value == "true"
        elseif valueType == "table" or valueType == "function" or valueType == "userdata" then
            --特殊类型
            for k, v in pairs(upperTable) do
                if tostring(k) == value then
                    value = k
                    break
                end
            end
        end
        return value
    end

    ---@public
    ---设置变量
    ---@param path string
    ---@param key string | any
    ---@param value string
    ---@return VariableData | boolean  --返回false时表示无法从堆栈设置变量，返回nil时表示完全无法设置变量
    function Utils.trySetVariableFromStack(path, key, value)
        local frameId = LuaDebug:getCurrentFrameId()
        local stackList = LuaDebug:getCurrentStackInfo()
        local stackInfo = stackList[frameId + 1]
        local vars = stackInfo.vars

        local paths = strSplit(path, "-->")
        --上值table
        local upperTable
        for i, v in ipairs(paths) do
            local nextVar = getVar(upperTable or vars, v)
            if not Utils.isNil(nextVar) then
                if type(nextVar) ~= "table" and not Utils.isCSharpTable(nextVar) and i ~= #paths then
                    upperTable = nil
                    break
                else
                    upperTable = nextVar
                end
            else
                upperTable = nil
                break
            end
        end

        if upperTable == nil then
            printErr(string.format("The variable \"%s\" does not exist, setting failure.", key))
            return nil
        end

        local nowValue, keyType = getVar(upperTable, key)
        local valueType = type(nowValue)
        if invalidValueTypeDict[valueType] then
            --无效类型
            printErr("Can't set value of type:" .. valueType)
            return nil
        end

        if upperTable == vars.locals or upperTable == vars.ups then
            return false
        end

        key = transformValue(upperTable, key, keyType)
        value = Utils.executeScriptInBreakPoint(value, true)
        Utils.rawset(upperTable, key, value)

        local valueStr
        if value ~= nil then
            valueStr = type(value) == "string" and string.format("\"%s\"", value) or value
        else
            valueStr = "nil"
        end
        print(string.format("Setting variable \"%s\" to {%s}", key, valueStr))
        return Utils.createVariable(value)
    end

    ---@public
    ---设置变量
    ---@param level number
    ---@param path string
    ---@param key string | any
    ---@param value string
    ---@return VariableData
    function Utils.setVariable(level, path, key, value)
        local stackValue = getStackValue(level + 1)
        local vars = {
            locals = stackValue.locals,
            ups = stackValue.ups,
            global = _G,
        }

        local paths = strSplit(path, "-->")

        --上值table
        local upperTable
        for i, v in ipairs(paths) do
            local nextVar = getVar(upperTable or vars, v)
            if not Utils.isNil(nextVar) then
                if type(nextVar) ~= "table" and not Utils.isCSharpTable(nextVar) and i ~= #paths then
                    upperTable = nil
                    break
                else
                    upperTable = nextVar
                end
            else
                upperTable = nil
                break
            end
        end
        if upperTable then
            --过滤不能设置变量的类型
            local nowValue, keyType = getVar(upperTable, key)
            local valueType = type(nowValue)
            if invalidValueTypeDict[valueType] then
                --无效类型
                printErr("Can't set value of type:" .. valueType)
                return
            end

            key = transformValue(upperTable, key, keyType)
            value = Utils.executeScript(value, level + 1, true)

            if upperTable == vars.locals then
                debug.setlocal(level, stackValue.localsIndex[key], value)
            elseif upperTable == vars.ups then
                debug.setupvalue(stackValue.func, stackValue.upsIndex[key], value)
            else
                Utils.rawset(upperTable, key, value)
            end


            local valueStr
            if value ~= nil then
                valueStr = type(value) == "string" and string.format("\"%s\"", value) or value
            else
                valueStr = "nil"
            end
            print(string.format("Setting variable \"%s\" to {%s}", key, valueStr))
            return Utils.createVariable(value)
        else
            printErr(string.format("The variable \"%s\" does not exist, setting failure.", key))
            return
        end
    end

    ---@public
    ---获取变量
    ---@param path string 路径
    ---@param isSearchSpecialKeyType boolean 是否搜索特殊key类型(table、function...)
    ---@return table
    ---@return string|unknown
    ---@return any
    function Utils.getVariable(path, isSearchSpecialKeyType)
        local scopeInfo = LuaDebug:getScopeInfo()
        local ret = { type = "nil", var = "nil" }
        local realPath = path
        local retTbkey
        if scopeInfo then
            retTbkey = tostring(scopeInfo.struct.invalid)
        end

        local frameId = LuaDebug:getCurrentFrameId()
        local vars = LuaDebug:getCurrentStackInfo()[frameId + 1].vars

        local paths = strSplit(path, "-->")
        local function searchVar(var)
            local tbkey = Utils.getTbKey(var)
            for k, v in ipairs(paths) do
                local nextVar = getVar(var, v)
                if not Utils.isNil(nextVar) then
                    if type(nextVar) ~= "table" and not Utils.isCSharpTable(nextVar) and k ~= #paths then
                        var = nil
                        tbkey = nil
                        break
                    else
                        if type(nextVar) == "table" or Utils.isCSharpTable(nextVar) then
                            tbkey = Utils.getTbKey(nextVar)
                        end

                        var = nextVar
                    end
                else
                    var = nil
                    tbkey = nil
                    break
                end
            end

            return var, tbkey
        end

        local isFindOgiPath = scopeInfo.struct[paths[1]] and true or false
        local var
        local tbkey
        if isFindOgiPath then
            var, tbkey = searchVar(vars)
        else
            --重新构造table，以定义查找顺序
            local varTb = {
                { k = "locals", v = vars.locals },
                { k = "ups", v = vars.ups },
                { k = "global", v = vars.global },
                { k = "watch", v = vars.watch },
                { k = "invalid", v = vars.invalid }
            }
            for k, v in ipairs(varTb) do
                var, tbkey = searchVar(v.v)
                if not Utils.isNil(var) then
                    realPath = v.k .. "-->" .. path
                    break
                end
            end
        end

        local realVar = var
        if not Utils.isNil(realVar) then
            if type(realVar) == "table" then
                ret = { type = "table", var = {} }
                for k, v in pairs(realVar) do
                    ret.var[tostring(k)] = Utils.createVariable(v)
                end

                traverseExtraVars(ret.var, realVar)
            elseif Utils.isCSharpTable(realVar) then
                ret = { type = "table", var = Utils.ParseCSharpValue(realVar) }
            elseif type(realVar) == "userdata" then
                ret = { type = realVar.GetType and (CSHARP_BASE_VALUE[tostring(realVar:GetType())] or "unknown") or
                    "unknown",
                    var = tostring(realVar) }
            else
                ret = Utils.createVariable(realVar)
            end

            retTbkey = tbkey
        end
        -- dump(ret, "retTbkey", 3)

        return ret, retTbkey, realPath
    end
end

--#endregion 变量操作----------------------------------

---@public
---监视
---@param exp string 表达式
---@return VariableData, string, string
function Utils.watchExpression(exp)
    local frameId = LuaDebug:getCurrentFrameId()
    local vars = LuaDebug:getCurrentStackInfo()[frameId + 1].vars

    local ret = Utils.executeScriptInBreakPoint(exp)
    --缓存监视变量
    vars.watch[exp] = ret

    local var
    local type = type(ret)
    if type == "table" then
        var = { type = "table", var = {} }
        for k, v in pairs(ret) do
            var.var[tostring(k)] = Utils.createVariable(v)
        end
    elseif type == "userdata" then
        var = { type = "table", var = Utils.ParseCSharpValue(ret) }
    else
        var = Utils.createVariable(ret)
    end

    --返回变量数据，tbkey，realPath
    return var, Utils.getTbKey(ret), "watch-->" .. exp
end

---将多个参数字符串连接起来
function Utils.unpackStr(...)
    local arg = tablePack(...)
    local len = arg.n or tableMaxKey(arg)


    if len == 0 then
        return "nil"
    else
        local strRet = {}
        for i = 1, len do
            local v = arg[i]
            if Utils.isNil(v) then
                strRet[i] = "nil"
            else
                local tp = type(v)
                if tp ~= "number" and tp ~= "string" then
                    strRet[i] = tostring(v)
                else
                    strRet[i] = v
                end
            end
        end

        return table.concat(strRet, "\t")
    end
end

function Utils.xpcall(func)
    xpcall(
        func,
        function(msg)
            printErr(msg .. "\n" .. debug.traceback())
        end
    )
end

function Utils.tableMerge(dst, src, isOverride, isDeep)
    for k, v in pairs(src) do
        if isOverride or not dst[k] then
            if isDeep then
                Utils.rawset(dst, k, v)
            else
                dst[k] = v
            end
        end
    end
end

---@public
---重载lua文件
---@param data S2C_ReloadLuaArgs
function Utils.reloadLua(data)
    Utils.xpcall(
        function()
            local luaPath = data.luaPath
            local oldValue = package.loaded[luaPath]
            if Utils.isNil(oldValue) then
                local idx = Utils.lastFind(luaPath, "%.")
                if idx then
                    luaPath = luaPath:sub(idx + 1, luaPath:len())
                    oldValue = package.loaded[luaPath]
                end
            end

            if oldValue then
                package.loaded[luaPath] = nil
                ---@diagnostic disable-next-line: undefined-field
                local realTab = Utils.require(luaPath)
                Utils.tableMerge(oldValue, realTab, true, true)

                LuaDebug:getSupportSocket():showDialogMessage("重载成功")
            else
                LuaDebug:getSupportSocket():showDialogMessage("重载失败，文件未被加载", 2)
            end
        end
    )
end

---public 比较两个path
function Utils.comparePath(path1, path2)
    local k = path1 .. path2
    if compareCache[k] ~= nil then
        return compareCache[k]
    else
        local path1Tb
        local path1Len
        local path2Tb
        local path2Len

        local cache = compareStrCache[path1]
        if cache then
            path1Tb = cache[1]
            path1Len = cache[2]
        else
            path1Tb = strSplit(path1, "/")
            path1Len = #path1Tb
            cache = {
                path1Tb,
                path1Len
            }
            compareStrCache[path1] = cache
        end

        cache = compareStrCache[path2]
        if cache then
            path2Tb = cache[1]
            path2Len = cache[2]
        else
            path2Tb = strSplit(path2, "/")
            path2Len = #path2Tb
            cache = {
                path2Tb,
                path2Len
            }
            compareStrCache[path2] = cache
        end

        local ret
        while true do
            if path1Tb[path1Len] ~= path2Tb[path2Len] then
                ret = false
                break
            end

            path1Len = path1Len - 1
            path2Len = path2Len - 1
            if path1Len == 0 or path2Len == 0 then
                ret = true
                break
            end
        end

        compareCache[k] = ret
        return ret
    end
end

---@public
---执行代码.
---@param conditionStr string 表达式
---@param level number 堆栈level
---@return any
function Utils.executeScript(conditionStr, level, isDisableErrorLog)
    level = level or 3
    local ret
    local vars = getStackValue(level + 1)
    local env = {}
    local locals = vars.locals
    local ups = vars.ups
    local global = _G

    if (locals) then
        for k, v in pairs(locals) do
            env[k] = v
        end
    end

    if (ups) then
        for k, v in pairs(ups) do
            if Utils.isNil(env[k]) then
                env[k] = v
            end
        end
    end

    for k, v in pairs(global) do
        if Utils.isNil(env[k]) then
            env[k] = v
        end
    end

    local fun = loadstring("return " .. conditionStr)

    local info = debug.getinfo(level)
    xpcall(
        function()
            setfenv(fun, env)
            ret = fun()
        end,
        function(msg)
            if not isDisableErrorLog then
                --表达式错误
                printErr(string.format("Expression error from [%s]:%d\n%s", info.source, info.currentline, msg))
            end
        end
    )
    return ret
end

---@public
---断点时执行代码
---@param exp string 表达式
---@param isSimpleRet boolean? 是否无须处理返回值
---@return any
function Utils.executeScriptInBreakPoint(exp, isSimpleRet)
    local frameId = LuaDebug:getCurrentFrameId()
    local vars = LuaDebug:getCurrentStackInfo()[frameId + 1].vars

    local fun = loadstring("return " .. exp)

    local env = {}
    for k, v in pairs(vars.locals) do
        env[k] = v
    end

    for k, v in pairs(vars.ups) do
        if Utils.isNil(env[k]) then
            env[k] = v
        end
    end

    for k, v in pairs(vars.global) do
        if Utils.isNil(env[k]) then
            env[k] = v
        end
    end

    local ret
    xpcall(
        function()
            setfenv(fun, env)
            if isSimpleRet then
                ret = fun()
            else
                ret = { fun() }
            end
        end,
        function(msg)
            -- printErr(msg)
            ret = nil
        end
    )
    if ret ~= nil then
        if isSimpleRet then
            return ret
        else
            if #ret == 0 then
                return nil
            elseif #ret == 1 then
                return ret[1]
            else
                return ret
            end
        end
    end
end

---@type Utils
return Utils
