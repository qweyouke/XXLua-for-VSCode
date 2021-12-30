--[
--    本插件占用全局函数
--    1.LuaDebuger: 调试器实例
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
local _rootName

do
    local xxlua_require = function(path)
        if _prefixPath then
            local path = _prefixPath .. path
            local fullPath = _rootName .. path
            local ret
            local isError
            xpcall(
                function()
                    ret = require(path)
                end,
                function()
                    isError = true
                    ret = require(fullPath)
                end
            )
            if not ret and not isError then
                ret = require(fullPath)
            end
            return ret
        else
            return require(path)
        end
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
        else
            _rootName = source:sub(1, firstIdx)
        end
    end

    if jit then
        xxlua_require("LuaDebugJit")
    else
        xxlua_require("LuaDebugOrigin")
    end
    xxlua_require("DebugUtils").require = require

    LuaDebuger:startDebug(host, port)
end
