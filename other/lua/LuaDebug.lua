--[
--    本插件占用全局函数
--    1.LuaDebug: 调试器实例
--    2.xxlua_require(): 调试器require方法（外部无用）
--    3.print() 打印
--    4.printErr() 错误打印
--    5.printWarning() 警告打印
--    6.dump() 打印整个table
--
--    本插件完全开源并有详细注释，欢迎广大开发者们自由自定义
--    Github: https://github.com/qweyouke/XXLua-for-VSCode
--]

--'require'函数 如果和你的项目不同，需要修改
local require = realRequire or require

--前缀路径
local _prefixPath
local _fullPrefixPath
--已加载文件
local loaded = {}

do
    local xxlua_require = function(path)
        if loaded[path] then
            return loaded[path]
        end
        local paths = {}
        if _prefixPath then
            table.insert(paths, _prefixPath .. path)
        end
        if _fullPrefixPath then
            table.insert(paths, _fullPrefixPath .. path)
        end
        table.insert(paths, path)

        
        local ret
        local idx = 1
        local len = #paths
        while idx <= len and not ret do
            pcall(
                function()
                    ret = require(paths[idx])
            end)
            idx = idx + 1
        end
        if ret then
            loaded[path] = ret
        end
        return ret
    end

    xpcall(
        function()
            _G.xxlua_require = xxlua_require
        end,
        function()
            rawset(_G, "xxlua_require", xxlua_require)
        end
    )
end

return function(host, port)
    local info = debug.getinfo(1)
    local source = info.short_src:gsub(".lua", ""):gsub("/", ".")

    local _, firstIdx = source:find("%.")
    if firstIdx then
        local ts = source:reverse()
        local _, lastIdx = ts:find("%.")
        lastIdx = ts:len() - lastIdx + 1
        
        _prefixPath = source:sub(firstIdx + 1, lastIdx)
        if _prefixPath == "" then
            _prefixPath = nil
        end
        _fullPrefixPath = source:sub(1, lastIdx)
        if _fullPrefixPath == "" then
            _fullPrefixPath = nil
        end
    end
    if jit then
        xxlua_require("LuaDebugJit")
    else
        xxlua_require("LuaDebugOrigin")
    end
    xxlua_require("DebugUtils").require = require

    LuaDebug:startDebug(host, port)
end
