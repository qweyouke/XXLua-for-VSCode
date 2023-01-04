---luajit调试器
---anthor: xxiong
---@class LuaDebugJit:DebugBase
---@field protected super DebugBase 父类
---@field private m_continueStackInfo StackInfo[] 跳过断点时的堆栈信息
---@field private m_stepNextTime number 单步跳过断点时hook的执行次数
---@field private m_stepNextDate number 单步跳过断点时的时间
---@field private m_isForceHitNextLine boolean 是否强制命中下一行断点
local LuaDebugJit = xxlua_require("DebugClass") ("LuaDebugJit", xxlua_require("DebugBase"))
---@type Utils
local Utils = xxlua_require("DebugUtils")
local _yield = coroutine.yield

---@protected
---override
function LuaDebugJit:ctor()
    self.super.ctor(self)
    self.m_continueStackInfo = nil
end

---@protected
---override
---重置调试变量
function LuaDebugJit:debugger_resetDebugInfo()
    self.super.debugger_resetDebugInfo(self)
    self.m_stepNextTime = 0
end

---@protected
---override
---重置运行
function LuaDebugJit:debugger_resetRun()
    self.super.debugger_resetRun(self)
    self.m_isForceHitNextLine = false
end

---@protected
---单步跳过
function LuaDebugJit:onStepNext()
    self.m_stepNextDate = os.clock()
    self.super.onStepNext(self)
end

---@protected
---override
---初始化
function LuaDebugJit:onInitialize()
    self:debugger_resetRun()
    local stack = _yield()

    local stackInfo = self.m_currentStackInfo[1]
    if stackInfo and stackInfo.lastlinedefined ~= stackInfo.currentline then
        self.m_continueStackInfo = self.m_currentStackInfo
    end

    self.m_debugSocket:pause(stack)
end

---@protected
---override
---继续
function LuaDebugJit:onContinue()
    --继续
    self:debugger_resetRun()
    local stack = _yield()

    local stackInfo = self.m_currentStackInfo[1]
    if stackInfo and stackInfo.lastlinedefined ~= stackInfo.currentline then
        self.m_continueStackInfo = self.m_currentStackInfo
    end

    self.m_debugSocket:pause(stack)
end

---@protected
---override
---hook函数
function LuaDebugJit:debug_hook(event, line)
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

    if self.m_continueStackInfo then
        local info = debug.getinfo(2, "lfS")
        if info.source == "=[C]" or info.source == "[C]" then
            return
        end

        local stackInfo = self.m_continueStackInfo[1]

        if stackInfo and stackInfo.func == info.func then
            if stackInfo.currentline == info.currentline then
                return
            else
                self.m_continueStackInfo = nil
            end
        end
    end

    if event == "line" then
        if self.m_isInRun and not self.m_breakLines[line] then
            return
        end

        local info = debug.getinfo(2, "lfS")
        if info.source == "=[C]" or info.source == "[C]" then
            return
        end

        local filePath, fileName, surfix = Utils.getFilePathInfo(info.source)
        if self.m_initData and self.m_initData.filterFiles then
            for i, v in pairs(self.m_initData.filterFiles) do
                if Utils.comparePath(filePath, v) then
                    return
                end
            end
        end

        if self.m_currentStackInfo then
            local stackInfo = self.m_currentStackInfo[1]

            if info.func == stackInfo.func and info.currentline == stackInfo.currentline then
                return
            end

            if self.m_isStepIn then
                self:hitBreakPoint()
                return
            end

            if self.m_isStepNext then
                local isNext = self.m_isForceHitNextLine

                if not isNext then
                    --查询当前堆栈函数
                    for i, v in ipairs(self.m_currentStackInfo) do
                        if (v.func == info.func) then
                            if (v.currentline == line) then
                                return
                            end

                            isNext = true
                            break
                        end
                    end
                else
                    self.m_isForceHitNextLine = false
                end

                if isNext then
                    local stackInfo = Utils.getStackInfo(3, false)
                    if info.lastlinedefined == info.currentline and #stackInfo == 1 then
                        --函数return ， 下一步强制进入断点
                        self.m_isForceHitNextLine = true
                    end

                    self:hitBreakPoint()
                    return
                else
                    --单步跳过时内部函数执行行数超过阈值 跳过本次操作
                    self.m_stepNextTime = self.m_stepNextTime + 1
                    if self.m_stepNextTime >= 1000000 or os.clock() - self.m_stepNextDate > 15 then
                        printWarn("代码执行异常, 重置堆栈信息")
                        self.m_supportSocket:resetStackInfo()
                        self:debugger_resetRun()
                    end
                end
            end
        end

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

---@public
---override
---停止调试
function LuaDebugJit:stopDebug()
    if self.m_supportSocket then
        self.m_continueStackInfo = nil
    end

    self.super.stopDebug(self)
end

---@type LuaDebugJit
local LuaDebug = LuaDebugJit.new()
xpcall(
    function()
        ---@type LuaDebugJit
        _G.LuaDebug = LuaDebug
    end,
    function()
        rawset(_G, "LuaDebug", LuaDebug)
    end
)
