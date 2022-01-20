---lua调试器
---anthor: xxiong
---@class LuaDebugOrigin:DebugBase
---@field protected super DebugBase 父类
---@field private m_stepInCount number 单步跳入次数
local LuaDebugOrigin = xxlua_require("DebugClass") ("LuaDebugOrigin", xxlua_require("DebugBase"))
---@type Utils
local Utils = xxlua_require("DebugUtils")

---@protected
---override
function LuaDebugOrigin:ctor()
    self.super.ctor(self)
    self.m_stepInCount = 0
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

    if self.m_isInRun and not self.m_breakLines[line] then
        return
    end

    if event == "call" then
        if not self.m_isInRun then
            self.m_stepInCount = self.m_stepInCount + 1
        end
    elseif event == "return" or event == "tail return" then
        if not self.m_isInRun then
            self.m_stepInCount = self.m_stepInCount - 1
        end
    end

    local info = debug.getinfo(2)
    if info.source == "=[C]" or info.source == "[C]" then
        return
    end

    local filePath, fileName = Utils.getFilePathInfo(info.source)

    if self.m_initData and self.m_initData.filterFiles then
        for i, v in pairs(self.m_initData.filterFiles) do
            if Utils.comparePath(filePath, v) then
                return
            end
        end
    end

    if self.m_currentStackInfo then
        if event == "line" then
            if self.m_isStepIn then
                self:hitBreakPoint()
                return
            elseif self.m_isStepNext then
                if self.m_stepInCount <= 0 then
                    self:hitBreakPoint()
                    return
                else
                    --查询当前堆栈函数 (主要用于在"pcall"函数中报错时call和return不成对的问题，只向上取3位，可能还是存在误差，不过绝大多数情况下够用了)
                    local len = #self.m_currentStackInfo
                    local i = len - 3
                    if i < 1 then
                        i = 1
                    end

                    for j = i, len do
                        local v = self.m_currentStackInfo[j]
                        if (v.func == info.func) then
                            self:hitBreakPoint()
                            return
                        end
                    end
                end
            end
        end
    end

    if event == "line" then
        --判断命中断点
        local breakPoints = self.m_breakPoints[fileName]
        if breakPoints then
            for k, v in pairs(breakPoints) do
                if v.line == line then
                    if Utils.comparePath(v.fullPath, filePath) then
                        --日志打印
                        if v.logMessage then
                            if v.logMessage:len() >= 3 then
                                if v.logMessage:sub(1, 3) == "###" then
                                    Utils.executeScript(
                                        string.format("print(%s)", v.logMessage:sub(4, v.logMessage:len()))
                                    )
                                    return
                                end
                            end

                            Utils.executeScript(string.format("print(%s)", v.logMessage))
                        end

                        --判断条件
                        if not v.condition or (v.condition and Utils.executeScript(v.condition)) then
                            self:hitBreakPoint()
                            return
                        end
                    end
                end
            end
        end
    end
end

---@type LuaDebugOrigin
local LuaDebug = LuaDebugOrigin.new()
xpcall(
    function()
        _G.LuaDebug = LuaDebug
    end,
    function()
        rawset(_G, "LuaDebug", LuaDebug)
    end
)
