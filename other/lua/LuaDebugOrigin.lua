---lua调试器
---anthor: xxiong
---@class LuaDebugOrigin:DebugBase
---@field protected super DebugBase 父类
---@field private m_stepInCount number 单步跳入次数
---@field private m_currentInfo debuginfo 当前调试信息
---@field private m_isLastReturn boolean 是否上一次是return
local LuaDebugOrigin = xxlua_require("DebugClass")("LuaDebugOrigin", xxlua_require("DebugBase"))
---@type Utils
local Utils = xxlua_require("DebugUtils")

-- local sysXpcall = xpcall;
-- xpcall = function(f, msgh, ...)
--     return sysXpcall(f, function(...)
--         print("发生报错，清理堆栈数据")
--         LuaDebug.m_supportSocket:resetStackInfo()
--         LuaDebug:debugger_resetRun()
--         return msgh(...)
--     end, ...)
-- end

-- local sysPcall = pcall;
-- pcall = function(f, ...)
--     print("进入luapcall")
--     local tb = {sysPcall(f, ...)}

--     if tb[1] == false then
--         print("发生报错，清理堆栈数据")
--         LuaDebug.m_supportSocket:resetStackInfo()
--         LuaDebug:debugger_resetRun()
--     end

--     local unpack = table.unpack or unpack
--     return unpack(tb)
-- end

---@protected
---override
function LuaDebugOrigin:ctor()
    self.super.ctor(self)
    self.m_stepInCount = 0
end

function LuaDebugOrigin:AddStepInCount()
    self.m_stepInCount = self.m_stepInCount + 1
end

function LuaDebugOrigin:SubStepInCount()
    if self.m_stepInCount > 0 then
        self.m_stepInCount = self.m_stepInCount - 1
    end
end

function LuaDebugOrigin:debugger_resetDebugInfo()
    self.super.debugger_resetDebugInfo(self)
    self.m_stepInCount = 0
end

---@protected
---override
---hook函数
function LuaDebugOrigin:debug_hook(event, line)
    if not self.m_supportSocket then
        self:debugger_initAttachServerHook()
        return
    end

    if event == "call" then
        if self.m_hookCallCount >= 100 then
            self.m_hookCallCount = 0
            --os.clock 此接口性能消耗极小 调用100万次只需50毫秒 故可用作定时器

            local time = os.clock()
            if time - self.m_lastReceiveTime > 0.1 then
                self.m_lastReceiveTime = time
                --接收辅助网络消息
                self:doReceiveSupportSocket()
            end
        else
            self.m_hookCallCount = self.m_hookCallCount + 1
        end
    end

    if self.m_isInRun then
        if line and not self.m_breakLines[line] then
            return
        else
            self.m_currentInfo = nil
        end
    end

    if line then
        local info = self.m_currentInfo
        if not info then
            info = debug.getinfo(2, "S")
            if info.source == "=[C]" then
                return
            end
            self.m_currentInfo = info
        end

        local filePath, fileName = Utils.getFilePathInfo(info.source)
        if Utils.isFilterFile(filePath) then
            return
        end

        if self.m_currentStackInfo then
            if self.m_isStepOut then
                --单步跳出
                if self.m_isLastReturn then
                    self.m_isLastReturn = false
                    if #self.m_currentStackInfo == 1 then
                        --堆栈深度只有1
                        --直接进入断点
                        self:hitBreakPoint(3)
                        return
                    else
                        local info2 = debug.getinfo(2, "f")
                        if info2.func == self.m_currentStackInfo[2].func then
                            --进入断点
                            self:hitBreakPoint(3)
                            return
                        end
                    end
                end

            elseif self.m_isStepIn then
                --单步跳入
                --进入断点
                self:hitBreakPoint(3)
                return
            elseif self.m_isStepNext then
                --单步跳过
                if self.m_stepInCount <= 0 then
                    -- 单步跳过时，如果执行时间超过阈值，则打印出来
                    local dt = os.clock() - self.m_lastNextTime
                    if dt > self.m_initData.expensiveCallNotifyThresholds then
                        local ret = string.format("%s[%s():%d] %0.6f", self.m_currentStackInfo[1].fileName,
                            self.m_currentStackInfo[1].functionName, self.m_currentStackInfo[1].currentline, dt)
                        printWarn("Expensive call: ", ret)
                    end
                    --进入断点
                    self:hitBreakPoint(3)
                    return
                else
                    -- xpcall和pcall的函数调用如果发生报错、tail call多层嵌套时
                    -- m_stepInCount可能会不成对的增减，导致m_stepInCount永远大于0，从而导致无法进入断点
                    -- 为了避免这种情况，这里做了一个保护，但仍可能存在突破保护的情况（即单步跳过时未断到下一步）
                    -- 突破保护后直到进入下一个手动打的断点之前，代码执行性能将小幅下降
                    if self.m_isLastReturn then
                        self.m_isLastReturn = false
                        local info2 = debug.getinfo(2, "f")
                        if self.m_currentStackInfo[1].func == info2.func then
                            -- 单步跳过时，如果执行时间超过阈值，则打印出来
                            local dt = os.clock() - self.m_lastNextTime
                            if dt > self.m_initData.expensiveCallNotifyThresholds then
                                local ret = string.format("%s[%s():%d] %0.6f", self.m_currentStackInfo[1].fileName,
                                    self.m_currentStackInfo[1].functionName, self.m_currentStackInfo[1].currentline, dt)
                                printWarn("Expensive call: ", ret)
                            end

                            -- 进入断点
                            self:hitBreakPoint(3)
                            return
                        end
                    end
                end
            end
        end

        --判断命中断点
        local breakPoints = self.m_breakPoints[fileName]
        if breakPoints then
            local breakInfo = breakPoints[line]
            if breakInfo then
                if Utils.comparePath(breakInfo.fullPath, filePath) then
                    --日志打印
                    if breakInfo.logMessage then
                        if breakInfo.logMessage:len() >= 3 then
                            if breakInfo.logMessage:sub(1, 3) == "###" then
                                local exp = breakInfo.logMessage:sub(4, breakInfo.logMessage:len())
                                Utils.executeScript(string.format("print(%s)", exp))
                                return
                            end
                        end

                        Utils.executeScript(string.format("print(%s)", breakInfo.logMessage))
                    end

                    --判断条件
                    if not breakInfo.condition or (breakInfo.condition and Utils.executeScript(breakInfo.condition)) then
                        self:hitBreakPoint(3)
                        return
                    end
                end
            end
        end
    elseif event == "call" or event == "tail call" then
        if not self.m_isInRun then
            if event == "tail call" then
                --tail call实际上相当于return和call事件同时调用、所以引用计数需要先减1再加1
                self:SubStepInCount()
            end
            self:AddStepInCount()
        end
        local info = debug.getinfo(2, "S")
        if info.source == "=[C]" then
            return
        end
        self.m_currentInfo = info
    elseif event == "return" or event == "tail return" then
        if not self.m_isInRun then
            self:SubStepInCount()
        end
        self.m_currentInfo = nil
        self.m_isLastReturn = true
    end
end

---@type LuaDebugOrigin
local instance = LuaDebugOrigin.new()
Utils.xpcall(
    function()
        _G.LuaDebug = instance
    end,
    function()
        rawset(_G, "LuaDebug", instance)
    end
)
if true then
    return
end
_G.LuaDebug = instance
