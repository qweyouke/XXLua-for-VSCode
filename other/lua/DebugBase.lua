xxlua_require("DebugFunctions")

---调试器类基
---author: xxiong
---
---@class DebugBase:DebugClass
---@field protected m_initData S2C_InitializeArgs
---@field private m_host string ip
---@field private m_port number 端口
---@field private m_loop_coroutine thread 主循环协程
---@field private m_hook_func fun(event:string, line:number) 钩子函数
---@field private m_hook_type string 钩子类型
---@field protected m_debugSocket DebugClient 调试socket
---@field protected m_supportSocket DebugClient 辅助socket
---@field private m_attachServer DebugServer 附加服务器 用于中途附加调试
---@field protected m_breakPoints table<string,BreakInfo[]>
---@field protected m_breakLines table<number, boolean> 是否有该行的断点
---@field private m_isHookEnabled boolean 是否启用hook
---@field protected m_currentStackInfo StackInfo[] 当前堆栈信息
---@field private m_scopeInfo ScopeInfo[] 变量域数据
---@field private m_currentFrameId number 当前堆栈Id
---@field protected m_isInRun boolean 是否运行中
---@field protected m_isStepNext boolean 是否单步跳过
---@field protected m_isStepIn boolean 是否单步跳入
---@field protected m_isStepOut boolean 是否单步跳出
---@field private m_hookCallCount number hook调用次数
---@field private m_lastReceiveTime number 最后一次receive时间
---@field private m_lastNextTime number 最后一次单步跳过时间
---@field private m_setVariableCache S2C_setVariable[]
local DebugBase = xxlua_require("DebugClass")("DebugBase")

local _yield = coroutine.yield
local _resume = coroutine.resume
coroutine.resume = function(co, ...)
    if coroutine.status(co) ~= "dead" then
        debug.sethook(co, LuaDebug:getHookFunc())
    end
    return _resume(co, ...)
end
local _wrap = coroutine.wrap
coroutine.wrap = function(fun)
    local newFun = _wrap(function()
        debug.sethook(LuaDebug:getHookFunc())
        return fun();
    end)
    return newFun
end
local _sethook = debug.sethook
debug.sethook = function(...)
    local debugHook = LuaDebug:getHookFunc()
    local args = { ... }

    if debugHook then
        local newHook = (args[1] and type(args[1]) == "function") and args[1] or args[2]
        if newHook and newHook ~= debugHook then
            printWarn(debug.traceback("Setting hook functions outside the debugger has invalidated the debugger", 2))
        end
    end

    _sethook(...)
end


---@type Utils
local Utils = xxlua_require("DebugUtils")
---@type Protocol
local Protocol = xxlua_require("DebugProto")

local function handler(target, method)
    return function(...)
        return method(target, ...)
    end
end

function DebugBase:ctor()
    self.m_breakPoints = {}
    self.m_hookCallCount = 0
    self.m_lastReceiveTime = 0
    self.m_breakLines = {}
    self.m_setVariableCache = {}
    self:debugger_resetRun()
end

---@private
---初始化
function DebugBase:initialize()
    self.m_loop_coroutine = coroutine.create(handler(self, self.debugger_onLoop))
    _resume(self.m_loop_coroutine)
    self:debugger_initDebugHook()
end

---@public
---获取ip
function DebugBase:getHost()
    return self.m_host
end

function DebugBase:setHost(host)
    self.m_host = host
end

---@public
---获取端口
function DebugBase:getPort()
    return self.m_port
end

function DebugBase:setPort(port)
    self.m_port = port
end

---@public
---获取调试数据
---@return S2C_InitializeArgs
function DebugBase:getDebugData()
    return self.m_initData
end

---@public
---获得调试socket
---@return DebugClient
function DebugBase:getDebugSocket()
    return self.m_debugSocket
end

---@public
---获得辅助socket
---@return DebugClient
function DebugBase:getSupportSocket()
    return self.m_supportSocket
end

---@public
---获取当前堆栈数据
---@return StackInfo[]
function DebugBase:getCurrentStackInfo()
    return self.m_currentStackInfo
end

---@public
---是否正在命中断点
function DebugBase:isInHitPoint()
    return self.m_currentFrameId and true or false
end

---@public
---获取变量域
---@return ScopeInfo
function DebugBase:getScopeInfo(frameId)
    return self.m_scopeInfo[frameId or self.m_currentFrameId]
end

---@public
---获取当前堆栈id
function DebugBase:getCurrentFrameId()
    return self.m_currentFrameId
end

---@public
---获取断点数据
---@return table<string,BreakInfo>
function DebugBase:getBreakPoints()
    return self.m_breakPoints
end

---@public
---获取钩子函数
---@return fun(event:string, line:number), string
function DebugBase:getHookFunc()
    return self.m_hook_func, self.m_hook_type
end

---@private
---设置断点信息
---@param data S2C_SetBreakpointsArgs
function DebugBase:debugger_setBreakInfo(data)
    -- print("debugger_setBreakInfo",self.m_currentStackInfo and self.m_currentStackInfo or "nil",self.m_stepInCount and self.m_stepInCount or "nil")
    for k, v in pairs(data.breakPoints) do
        if #v == 0 then
            self.m_breakPoints[k] = nil
        else
            local breakDatas = {}
            for k2, v2 in ipairs(v) do
                breakDatas[v2.line] = v2
            end

            self.m_breakPoints[k] = breakDatas
        end
    end

    self.m_breakLines = {}
    for k, breakInfo in pairs(self.m_breakPoints) do
        for k2, v in pairs(breakInfo) do
            self.m_breakLines[k2] = true
        end
    end

    if not self.m_isHookEnabled then
        --检查是否需要断点
        for k, v in pairs(self.m_breakPoints) do
            self.m_isHookEnabled = true
            break
        end
    end
end

---@private
---初始化事件
---@param data S2C_InitializeArgs
function DebugBase:debugger_Initialize(data)
    if self.m_initData then
        return
    end

    self.m_initData = data
    --取消阻塞
    self.m_supportSocket:setTimeout(0)

    self:initialize()
end

---@protected
---设置调试hook
function DebugBase:debugger_initDebugHook()
    self.m_hook_func = handler(self, self.debug_hook)
    self.m_hook_type = "lrc"
    debug.sethook(self.m_hook_func, self.m_hook_type)
end

---@protected
---设置附加服务器hook
function DebugBase:debugger_initAttachServerHook()
    self.m_hook_func = handler(self, self.tryAcceptAttachServer)
    self.m_hook_type = "c"
    debug.sethook(self.m_hook_func, self.m_hook_type)
end

---@protected
---重置调试变量
function DebugBase:debugger_resetDebugInfo()
    self.m_isInRun = false
    self.m_isStepNext = false
    self.m_isStepIn = false
    self.m_isStepOut = false
    self.m_currentFrameId = nil
    self.m_scopeInfo = {}
end

---@protected
---重置运行
function DebugBase:debugger_resetRun()
    self:debugger_resetDebugInfo()
    self.m_isInRun = true
    self.m_currentStackInfo = nil
    -- print("debugger_resetRun")
end

---@private
---主循环
---
function DebugBase:debugger_onLoop()
    while true do
        if self.m_debugSocket then
            local msg = self.m_debugSocket:receive()
            if msg then
                -- dump(msg, "DebugClient Receive", 2)
                if msg == "closed" then
                    self:stopDebug()
                else
                    ---@type Protocol
                    local cmd = msg.command
                    if cmd == Protocol.stop then
                        --停止
                        self:stopDebug()
                    elseif cmd == Protocol.initialize then
                        --初始化
                        self:onInitialize()
                    elseif cmd == Protocol.continue then
                        --继续
                        self:onContinue()
                    elseif cmd == Protocol.next then
                        --单步跳过
                        self:onStepNext()
                    elseif cmd == Protocol.stepIn then
                        --单步跳入
                        self:onStepIn()
                    elseif cmd == Protocol.stepOut then
                        --单步跳出
                        self:onStepOut()
                    elseif cmd == Protocol.setBreakpoints then
                        --断点信息
                        ---@type S2C_SetBreakpointsArgs
                        local args = msg.args
                        self:debugger_setBreakInfo(args)
                    elseif cmd == Protocol.getScopes then
                        --获取变量域
                        Utils.xpcall(
                            function()
                                if not self.m_currentStackInfo then
                                    return
                                end

                                ---@type S2C_getScopes
                                local args = msg.args
                                self.m_currentFrameId = args.frameId

                                local scopeInfo = Utils.loadScopes()
                                self.m_scopeInfo[args.frameId] = scopeInfo
                                self.m_debugSocket:sendScopes(args.frameId, scopeInfo)
                            end
                        )
                    elseif cmd == Protocol.getVariable then
                        --获取变量
                        Utils.xpcall(
                            function()

                                ---@type S2C_getVariable
                                local args = msg.args
                                self.m_currentFrameId = args.frameId
                                local vars, tbkey, realPath = Utils.getVariable(args.path, args.isMustBeTable)

                                self.m_debugSocket:sendVariable(args.path, args.frameId, vars, tbkey, realPath)
                            end
                        )
                    elseif cmd == Protocol.watchVariable then
                        --监视变量
                        Utils.xpcall(
                            function()
                                ---@type S2C_watchVariable
                                local args = msg.args
                                self.m_currentFrameId = args.frameId

                                local var, tbkey, realPath = Utils.watchExpression(args.exp)

                                self.m_debugSocket:sendWatch(args.exp, args.frameId, var, tbkey, realPath)
                            end
                        )
                    elseif cmd == Protocol.setVariable then
                        --设置变量
                        Utils.xpcall(
                            function()
                                ---@type S2C_setVariable
                                local args = msg.args
                                self.m_currentFrameId = args.frameId

                                --先尝试从堆栈中设置变量
                                local var = Utils.trySetVariableFromStack(args.path, args.name, args.value)

                                if var then
                                    self.m_debugSocket:sendSetVariable(args.path, args.frameId, var)
                                elseif var == false then
                                    --堆栈中没有找到变量，缓存起来，等待协程yield（程序继续运行）时设置
                                    table.insert(self.m_setVariableCache, msg.args)
                                    print(string.format("Ready to set variable \"%s\" to {%s}. Skip the current breakpoint to take effect", args.name, args.value))
                                end
                            end
                        )
                    end
                end
            end
        else
            _yield()
            break
        end
    end
end

---@protected
---初始化
function DebugBase:onInitialize()
    self:debugger_resetRun()
    local stack = _yield()
    self.m_debugSocket:pause(stack)
end

---@protected
---继续
function DebugBase:onContinue()
    self:debugger_resetRun()
    local stack = _yield()
    self.m_debugSocket:pause(stack)
end

---@protected
---单步跳过
function DebugBase:onStepNext()
    self:debugger_resetDebugInfo()
    self.m_lastNextTime = os.clock()
    self.m_isStepNext = true
    local stack = _yield()
    self.m_debugSocket:pause(stack)
end

---@protected
---单步跳入
function DebugBase:onStepIn()
    self:debugger_resetDebugInfo()
    self.m_isStepIn = true
    local stack = _yield()
    self.m_debugSocket:pause(stack)
end

---@protected
---单步跳出
function DebugBase:onStepOut()
    self:debugger_resetDebugInfo()
    self.m_isStepOut = true
    local stack = _yield()
    self.m_debugSocket:pause(stack)
end

---@protected
---hook函数 需重载
function DebugBase:debug_hook(event, line)
    --lua函数调用性能不高，不再调用父类debug_hook 所有逻辑由子类写
    printErr("Error, The function needs to override")
end

---@private
---尝试连接附加服务
function DebugBase:tryAcceptAttachServer(event, line)
    if self.m_hookCallCount >= 100 then
        self.m_hookCallCount = 0

        --os.clock 此接口性能消耗极小 调用100万次只需50毫秒 故可用作定时器
        local time = os.clock()
        if time - self.m_lastReceiveTime > 0.1 then
            self.m_lastReceiveTime = time
            self:doReceiveAttachSocket()
        end
    else
        self.m_hookCallCount = self.m_hookCallCount + 1
    end
end

---@private
---接收附加调试网络消息
function DebugBase:doReceiveAttachSocket()
    if self.m_attachServer then
        if self.m_attachServer:accept() then
            local msg = self.m_attachServer:receive()
            if msg then
                local cmd = msg.command

                if cmd == Protocol.startDebug then
                    ---@type S2C_StartDebug
                    local args = msg.args
                    self:startDebug(args.host, args.port)

                    return true
                end
            end
        end
    end
end

---@protected
---接收辅助网络消息
function DebugBase:doReceiveSupportSocket()
    -- print("doReceiveSupportSocket")
    --接收辅助数据
    if self.m_supportSocket then
        local msg = self.m_supportSocket:receive()
        if msg then
            if msg == "closed" then
                --停止
                self:stopDebug()
            else
                ---@type Protocol
                local cmd = msg.command
                -- dump(msg, "SupportClient Receive")

                if cmd == Protocol.stop then
                    --停止
                    self:stopDebug()
                elseif cmd == Protocol.initialize then
                    --初始化
                    self:debugger_Initialize(msg.args)
                elseif cmd == Protocol.setBreakpoints then
                    ---@type S2C_SetBreakpointsArgs
                    --断点信息
                    self:debugger_setBreakInfo(msg.args)
                    --接收到断点信息时，连续进入阻塞状态，节省时间
                    self:doReceiveSupportSocket()
                elseif cmd == Protocol.reloadLua then
                    ---@type S2C_ReloadLuaArgs
                    self.reloadData = msg.args
                end
            end
        end

        if self.reloadData then
            local data = self.reloadData
            self.reloadData = nil
            Utils.reloadLua(data)
        end
    end
end

---@public
---命中断点 (开发者用)
function DebugBase:hitBreakPoint(level)
    if not self.m_initData then
        return
    end

    if self:isInHitPoint() then
        -- print("正在断点中，跳过断点\n", debug.traceback())
        return
    end

    -- print("进入断点\n", debug.traceback())

    level = level or 3
    local stackInfo = Utils.getStackInfo(level + 1, true)

    self.m_currentStackInfo = stackInfo

    local stacks = {}
    for i, v in ipairs(stackInfo) do
        local stack = {
            fileName = v.fileName,
            filePath = v.filePath,
            currentline = v.currentline,
            functionName = v.functionName or tostring(v.func)
        }
        table.insert(stacks, stack)
    end

    -- dump(infos,"hitBreakPoint")
    _resume(self.m_loop_coroutine, stacks)
    self:checkSetVariable(level + 1)
end

function DebugBase:checkSetVariable(level)
    if next(self.m_setVariableCache) then
        Utils.xpcall(
            function()
                for i, v in ipairs(self.m_setVariableCache) do
                    Utils.setVariable(level + 1 + 3, v.path, v.name, v.value)
                end
            end
        )
        self.m_setVariableCache = {}
    end
end

---@public
---远程附加调试 (给测试人员用)
---使用此方法，会阻塞线程
---然后开发人员可修改launch.json中的clientHost为测试机ip，然后启动调试器连接到测试机，保证socket能连上就能调试。
function DebugBase:remoteHitBreakPoint(level)
    if self.m_supportSocket then
        self:hitBreakPoint(level)
        return
    end

    if self:isInHitPoint() then
        return
    end

    --阻塞线程保留案发现场 等待远程连接
    while self.m_attachServer do
        if self:doReceiveAttachSocket() then
            self:remoteHitBreakPoint(5)
            return
        end
    end
end

---@public
---关闭附加服务器
function DebugBase:closeAttachServer()
    if self.m_attachServer then
        self.m_attachServer:close()
        self.m_attachServer = nil
    end
end

---@public
---停止调试
function DebugBase:stopDebug()
    print("StopDebug")

    if self.m_supportSocket then
        self.m_supportSocket:close()
        self.m_supportSocket = nil
        self.m_debugSocket:close()
        self.m_debugSocket = nil

        self.m_hook_func = nil
        self.m_hook_type = nil

        self.m_initData = nil
        self.m_breakPoints = {}
        self.m_isHookEnabled = false
        self:debugger_resetRun()
    end

    self:startAttachServer()
end

---@public
---开始调试
---@param host string ip地址 本地localhost
---@param port number 端口 同launch配置
function DebugBase:startDebug(host, port)
    host = host or self.m_host
    port = port or self.m_port

    if not host or (host and type(host) ~= "string") then
        error("host is error")
    end

    if not port or (port and type(port) ~= "number") then
        error("port is error")
    end

    self.m_host = host
    self.m_port = port

    self:closeAttachServer()

    print(string.format("Try to connect the debugger(%s:%d)", host, port))

    --辅助socket
    self.m_supportSocket = xxlua_require("DebugClient").new()
    local server = self.m_supportSocket:connect(host, port)
    if server then
        --调试socket
        self.m_debugSocket = xxlua_require("DebugClient").new()
        self.m_debugSocket:connect(host, port)
        print("Launch debugger in " .. _VERSION .. (jit and " " .. jit.version or ""))

        --阻塞主线程 等待断点数据返回
        self.m_supportSocket:setTimeout(3000)
        --立即进入阻塞状态
        self:doReceiveSupportSocket()
        return true
    else
        -- print("连接失败")
        self.m_supportSocket = nil
        self:startAttachServer()
        return false
    end
end

---@public
---启动附加服务器
function DebugBase:startAttachServer()
    if not self.m_port then
        return
    end
    Utils.xpcall(function()
        if not self.m_attachServer then
            --附加服务器
            self.m_attachServer = xxlua_require("DebugServer").new()
            self.m_attachServer:createServer(self.m_port + 1)

            ---附加调试原理为客户端未连接到调试器时启动一个附加服务器，当调试器启动时会尝试连接这个服务器，连接上再由客户端向调试器发起调试连接。
            ---但是在unity编辑器模式时，这个“附加服务器端口”会绑定在unity编辑器上，即结束游戏运行时并不会销毁该端口，导致再次运行客户端并启动附加服务器时会因端口被占用而启动失败，进而无法附加调试
            ---所以需要在游戏退出时，自行调用销毁端口函数
            ---
            ---如果有其他类似情况，也需要自行添加销毁端口函数
            if Utils.isLoadedLuaDebugTool() then
                CS.LuaDebugTool.Init(
                    function()
                        printErr("Game quit, close server socket")
                        self:closeAttachServer()
                    end
                )
            end

            self:debugger_initAttachServerHook()
        end
    end)
end

return DebugBase
