---工具类
---anthor: xxiong
---@class Utils
local Utils = {}
local filePathCachePaths = {}
local fullPathCachePaths = {}
local compareStrCache = {}
local compareCache = {}
local rootLastDir
---@diagnostic disable-next-line: deprecated
local loadstring = loadstring or load
local CSHARP_BASE_VALUE = {
    ["System.Boolean"] = "boolean",
    ["System.Char"] = "string",
    ["System.String"] = "string",
    ["System.Int16"] = "number",
    ["System.Int32"] = "number",
    ["System.Int64"] = "number",
    ["System.IntPtr"] = "number",
    ["System.Byte"] = "number",
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
            elseif not name then
                break
            end

            i = i + 1
        end

        return fn
    end
end

--获取table地址
function Utils.getTbKey(var)
    if type(var) == "userdata" and CS.LuaDebugTool then
        return CS.LuaDebugTool.GetTbKey(var)
    else
        return tostring(var)
    end
end

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

function Utils.isCSharpTable(var)
    local a
    Utils.xpcall(function()
        a = (type(var) == "userdata" and not CSHARP_BASE_VALUE[var:GetType():ToString()])
    end)
    return a
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

local function getStackValue(f)
    local i = 1
    local locals = {}
    -- get locals
    while true do
        local name, value = debug.getlocal(f, i)
        if not name then
            break
        end

        if name ~= "(*temporary)" then
            locals[name] = value
        end

        i = i + 1
    end

    local func = debug.getinfo(f, "f").func
    i = 1
    local ups = {}
    while func do -- check for func as it may be nil for tail calls
        local name, value = debug.getupvalue(func, i)
        if not name then
            break
        end

        if name == "_ENV" then
            ups["_ENV_"] = value
        else
            ups[name] = value
        end

        i = i + 1
    end

    return { locals = locals, ups = ups }
end

--获取堆栈
---@return StackInfo[]
function Utils.getStackInfo(ignoreCount, isFindVar)
    local ret = {}
    for i = ignoreCount, 100 do
        local source = debug.getinfo(i)
        if not source then
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
    local stackInfo = LuaDebuger:getCurrentStackInfo()[LuaDebuger:getCurrentFrameId() + 1].vars
    stackInfo.global = _G
    stackInfo.invalid = {}
    stackInfo.watch = {}

    for k, v in pairs(stackInfo) do
        scopeData.struct[k] = tostring(v)
    end

    return scopeData
end

function Utils.ParseCSharpValue(csharpVar)

    local varInfos = {}
    if CS.LuaDebugTool then

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
            -- print("getUserDataInfo")

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

--过滤特殊不可见字符
function Utils.filterSpecChar(s)
    local ss = {}
    local k = 1
    while true do
        if k > #s then
            break
        end

        local c = string.byte(s, k)
        if not c then
            break
        end

        if c < 192 then
            if c >= 32 and c <= 126 then
                table.insert(ss, string.char(c))
            else
                table.insert(ss, "?")
            end

            k = k + 1
        elseif c < 224 then
            k = k + 2
        elseif c < 240 then
            if c >= 228 and c <= 233 then
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
            end

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
            return { type = CSHARP_BASE_VALUE[v:GetType():ToString()], var = v:ToString() }
        elseif type == "string" then
            v = Utils.filterSpecChar(tostring(v))
            return { type = "string", var = v }
        else
            return { type = type, var = tostring(v) }
        end
    end
end

function Utils.rawget(tb, key)
    -- return rawget(tb, key)
    local ret
    xpcall(
        function()
            ret = tb[key]
        end,
        function()
            xpcall(
                function()
                    ret = tb[tonumber(key)]
                end,
                function()
                    ret = rawget(tb, key)
                end
            )
        end
    )
    return ret
end

function Utils.rawset(tb, key, value)
    xpcall(
        function()
            tb[key] = value
        end,
        function()
            xpcall(
                function()
                    tb[tonumber(key)] = value
                end,
                function()
                    rawset(tb, key, value)
                end
            )
        end
    )
    -- rawset(tb, key, value)
end

---@public
---获取变量
function Utils.getVariable(path)
    local scopeInfo = LuaDebuger:getScopeInfo()
    local ret = { type = "nil", var = "nil" }
    local realPath = path
    local retTbkey
    if scopeInfo then
        retTbkey = tostring(scopeInfo.struct.invalid)
    end

    Utils.xpcall(
        function()
            local frameId = LuaDebuger:getCurrentFrameId()
            local vars = LuaDebuger:getCurrentStackInfo()[frameId + 1].vars
            local debugData = LuaDebuger:getDebugData()

            local loadExtraVar
            loadExtraVar = function(var, tb)
                for i, v in ipairs(debugData.externalVariables) do
                    local newVar = Utils.rawget(var, v)
                    if newVar then
                        if type(newVar) == "table" then
                            for k2, v2 in pairs(newVar) do
                                if not Utils.rawget(tb, k2) then
                                    Utils.rawset(tb, k2, v2)
                                end
                            end

                            loadExtraVar(newVar, tb)
                        else
                            if not Utils.rawget(tb, v) then
                                Utils.rawset(tb, v, newVar)
                            end
                        end
                    end
                end
            end

            local function getVar(var, k)
                if not var then
                    return nil
                end

                if type(var) == "table" then
                    local v = Utils.rawget(var, k)
                    if not v then
                        local tb = {}
                        loadExtraVar(var, tb)
                        v = tb[k]
                    end

                    if not v then
                        k = tonumber(k)
                        v = Utils.rawget(var, k)
                    end

                    return v
                elseif Utils.isCSharpTable(var) and CS.LuaDebugTool then
                    return CS.LuaDebugTool.GetCSharpValue(var, k)
                end

                return nil
            end

            local paths = path:split("-")
            local function findVar(var)
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
                var, tbkey = findVar(vars)
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
                    -- dump(v)
                    var, tbkey = findVar(v.v)
                    if var then
                        realPath = v.k .. "-" .. path
                        break
                    end
                end
            end

            local realVar = var
            if realVar then
                if type(realVar) == "table" then
                    ret = { type = "table", var = {} }
                    for k, v in pairs(realVar) do
                        ret.var[tostring(k)] = Utils.createVariable(v)
                    end

                    Utils.findExtraVars(ret.var, realVar)
                elseif Utils.isCSharpTable(realVar) then
                    ret = { type = "table", var = Utils.ParseCSharpValue(realVar) }
                elseif type(realVar) == "userdata" then
                    ret = { type = CSHARP_BASE_VALUE[realVar:GetType():ToString()], var = realVar:ToString() }
                else
                    ret = Utils.createVariable(realVar)
                end

                retTbkey = tbkey
            end
        end
    )
    -- dump(ret, "retTbkey", 3)

    return ret, retTbkey, realPath
end

---@public
---监视变量
function Utils.watchVariable(exp)
    local frameId = LuaDebuger:getCurrentFrameId()
    local vars = LuaDebuger:getCurrentStackInfo()[frameId + 1].vars

    local fun = loadstring("return " .. exp)

    local env = {}
    for k, v in pairs(vars.locals) do
        env[k] = v
    end

    for k, v in pairs(vars.ups) do
        if not env[k] then
            env[k] = v
        end
    end

    for k, v in pairs(vars.global) do
        if not env[k] then
            env[k] = v
        end
    end

    local ret
    xpcall(
        function()
            setfenv(fun, env)
            ret = fun()
        end,
        function(msg)
            ret = nil
        end
    )

    return ret
end

---查看额外变量
---@param ret table 存储表
---@param var table 目标表
function Utils.findExtraVars(ret, var)
    if type(ret) ~= "table" or type(var) ~= "table" then
        return
    end

    local cacheKeys = {}
    for k, v in pairs(ret) do
        cacheKeys[k] = true
    end

    local getExtraVars
    getExtraVars = function(tb, key, prefix)
        local newVar = Utils.rawget(tb, key)
        if newVar then
            if type(newVar) == "table" then
                for k, v in pairs(newVar) do
                    if not cacheKeys[k] then
                        local newKey
                        if prefix then
                            newKey = k .. " [" .. prefix .. "." .. key .. "]"
                        else
                            newKey = k .. " [" .. key .. "]"
                        end

                        cacheKeys[k] = true
                        Utils.rawset(ret, newKey, Utils.createVariable(v))
                    end
                end

                getExtraVars(newVar, key, prefix and prefix .. "." .. key or key)
            elseif not cacheKeys[key] then
                local newKey
                if prefix then
                    newKey = key .. " [" .. prefix .. "." .. key .. "]"
                else
                    newKey = key .. " [" .. key .. "]"
                end

                cacheKeys[key] = true
                Utils.rawset(ret, newKey, Utils.createVariable(newVar))
            end
        end
    end

    local debugData = LuaDebuger:getDebugData()
    for _, key in ipairs(debugData.externalVariables) do
        getExtraVars(var, key)
    end
end

---将多个参数字符串连接起来
function Utils.unpackStr(...)
    local arg = { ... }
    local str = ""
    if #arg == 0 then
        arg = { "nil" }
    end

    for k, v in pairs(arg) do
        str = str .. tostring(v) .. "\t"
    end

    return str
end

function Utils.xpcall(func)
    xpcall(
        func,
        function(msg)
            printErr(msg .. "\n" .. debug.traceback())
        end
    )
end

---@public
---重载lua文件
---@param data S2C_ReloadLuaArgs
function Utils.reloadLua(data)
    local luaPath = data.luaPath
    local oldValue = package.loaded[luaPath]
    if not oldValue then
        local idx = Utils.lastFind(luaPath, "%.")
        if idx then
            luaPath = luaPath:sub(idx + 1, luaPath:len())
            oldValue = package.loaded[luaPath]
        end
    end

    if oldValue then
        package.loaded[luaPath] = nil
        local realTab = xxlua_require(luaPath)
        table.merge(oldValue, realTab)

        LuaDebuger:getSupportSocket():showDialogMessage("重载成功")
    else
        LuaDebuger:getSupportSocket():showDialogMessage("重载失败，文件未被加载", 2)
    end
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
            path1Tb = path1:split("/")
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
            path2Tb = path2:split("/")
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
---执行代码
function Utils.executeScript(conditionStr, level)
    level = level or 4
    local ret
    local vars = getStackValue(level)
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
            if not env[k] then
                env[k] = v
            end
        end
    end

    for k, v in pairs(global) do
        if not env[k] then
            env[k] = v
        end
    end

    local fun = loadstring("return " .. conditionStr)

    xpcall(
        function()
            setfenv(fun, env)
            ret = fun()
        end,
        function(msg)
            local info = debug.getinfo(level + 3)
            ret = "表达式错误：" .. "from [" .. info.source .. "]:" .. info.currentline .. "\n" .. msg
        end
    )
    return ret
end

---@type Utils
return Utils
