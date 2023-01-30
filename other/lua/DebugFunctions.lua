---公共函数
---anthor: xxiong

---@type Utils
local Utils = xxlua_require("DebugUtils")

---@class NetData
---@field command string
---@field args table
local NetData

local printOrigin = print

---@class PrintTypeData
---@field type number 0普通、2警告、3错误
---@field func fun(msg: string) 打印函数

---@class PRINT_TYPE
---@field NORMAL PrintTypeData
---@field WARNING PrintTypeData
---@field ERROR PrintTypeData
local PRINT_TYPE = {
    NORMAL = { type = 0, func = (CS and CS.UnityEngine) and CS.UnityEngine.Debug.Log or printOrigin },
    WARNING = { type = 1, func = (CS and CS.UnityEngine) and CS.UnityEngine.Debug.LogWarning or printOrigin },
    ERROR = { type = 2, func = (CS and CS.UnityEngine) and CS.UnityEngine.Debug.LogError or printOrigin }
}

local PRINT_FORMAT = {
    DEFAULT = function(color, str)
        return string.format("<b><color=#999999>[Lua] </color></b>%s\n", color, str)
    end,
    DUMP = function(color, title, des)
        return string.format("<b><color=#999999>[Lua] </color></b><color=#3A9BFF>%s</color>%s\n", color, title, des)
    end
}


---@private
---@param typeData PrintTypeData
---@param str string
local function doConsolePrint(typeData, str)
    ---@type S2C_InitializeArgs
    local debugData = LuaDebug and LuaDebug:getDebugData() or nil
    if not debugData or (debugData and (debugData.printType == 1 or debugData.printType == 2)) then
        if LuaDebug then
            local debugSocket = LuaDebug:getSupportSocket()
            if debugSocket then
                debugSocket:printConsole(str, typeData.type)
            end
        end
    end
end

---@private
---@param typeData PrintTypeData
---@param str string
local function doNormalPrint(typeData, str)
    ---@type S2C_InitializeArgs
    local debugData = LuaDebug and LuaDebug:getDebugData() or nil
    if not debugData or (debugData and (debugData.printType == 1 or debugData.printType == 3)) then
        if typeData.func then
            typeData.func(PRINT_FORMAT.DEFAULT(str))
        else
            printOrigin(str)
        end
    end

    doConsolePrint(typeData, str)
end

---@private
---@param typeData PrintTypeData
---@param title string 标题
---@param des string 详情
local function doDumpPrint(typeData, title, des)
    ---@type S2C_InitializeArgs
    local debugData = LuaDebug and LuaDebug:getDebugData() or nil
    if not debugData or (debugData and (debugData.printType == 1 or debugData.printType == 3)) then
        if typeData.func then
            typeData.func(PRINT_FORMAT.DUMP(title, des))
        else
            printOrigin(title .. des)
        end
    end

    doConsolePrint(typeData, title .. des)
end

---@private
---@param type PRINT_TYPE
---@param ... string
local function doPrint(type, ...)
    local str = Utils.unpackStr(...)
    doNormalPrint(type, str)
end

function print(...)
    doPrint(PRINT_TYPE.NORMAL, ...)
end

function printErr(...)
    doPrint(PRINT_TYPE.ERROR, ...)
end

function printWarn(...)
    doPrint(PRINT_TYPE.WARNING, ...)
end

function dump(value, desciption, nesting)
    local function strSplit(input, delimiter)
        input = tostring(input)
        delimiter = tostring(delimiter)
        if delimiter == "" then
            return false
        end

        local pos, arr = 0, {}
        -- for each divider found
        for st, sp in function()
            return string.find(input, delimiter, pos, true)
        end do
            table.insert(arr, string.sub(input, pos, st - 1))
            pos = sp + 1
        end

        table.insert(arr, string.sub(input, pos))
        return arr
    end

    local function dstrTrim(input)
        input = string.gsub(input, "^[ \t\n\r]+", "")
        return string.gsub(input, "[ \t\n\r]+$", "")
    end

    if type(nesting) ~= "number" then
        nesting = 3
    end

    local lookupTable = {}
    local result = {}

    local function _k(k)
        local t = type(k)
        if t == "number" then
            k = '[' .. k .. ']'
        elseif t == "string" then
            k = '"' .. k .. '"'
        end
        return tostring(k)
    end

    local function _v(v)
        if type(v) == "string" then
            v = '"' .. v .. '"'
        end

        return tostring(v)
    end

    local traceback = strSplit(debug.traceback("", 2), "\n")
    local function _dump(value, desciption, indent, nest, keylen)
        if desciption == nil then
            desciption = "<var>"
        end
        local spc = ""
        if type(keylen) == "number" then
            spc = string.rep(" ", keylen - string.len(_k(desciption)))
        end

        if type(value) ~= "table" then
            result[#result + 1] = string.format("%s%s%s = %s", indent, _k(desciption), spc, _v(value))
        elseif lookupTable[value] then
            result[#result + 1] = string.format("%s%s%s = *REF*", indent, desciption, spc)
        else
            lookupTable[value] = true
            if nest > nesting then
                result[#result + 1] = string.format("%s%s = *MAX NESTING*", indent, desciption)
            else
                result[#result + 1] = string.format("%s%s = {", indent, _k(desciption))
                local indent2 = indent .. "    "
                local keys = {}
                local keylen = 0
                local values = {}
                for k, v in pairs(value) do
                    keys[#keys + 1] = k
                    local vk = _v(k)
                    local vkl = string.len(vk)
                    if vkl > keylen then
                        keylen = vkl
                    end

                    values[k] = v
                end

                table.sort(
                    keys,
                    function(a, b)
                        if type(a) == "number" and type(b) == "number" then
                            return a < b
                        else
                            return tostring(a) < tostring(b)
                        end
                    end
                )
                for i, k in ipairs(keys) do
                    -- print(k)
                    _dump(values[k], k, indent2, nest + 1, keylen)
                end

                result[#result + 1] = string.format("%s}", indent)
            end
        end
        if result[#result] then
            result[#result] = result[#result] .. ","
        end
    end

    _dump(value, desciption, " ", 1)

    local str
    for i, line in ipairs(result) do
        if not str then
            str = "\n" .. line
        else
            str = str .. "\n" .. line
        end
    end

    local stackStr = "dump from: " .. dstrTrim(traceback[3])
    local idx = Utils.lastFind(stackStr, ":")
    if idx then
        stackStr = stackStr:sub(1, idx - 1)
    end

    doDumpPrint(PRINT_TYPE.NORMAL, stackStr, str)
end
