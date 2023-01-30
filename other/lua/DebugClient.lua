---客户端
---anthor: xxiong
---
---@class DebugClient
---@field m_socket socket
---@field m_client userdata
local DebugClient = xxlua_require("DebugClass") ("DebugClient")

---@class socket socket本体
local socket = require("socket.core")

---@type json
local json = xxlua_require("DebugJson")
---@type Protocol
local Protocol = xxlua_require("DebugProto")
---@type Utils
local Utils = xxlua_require("DebugUtils")

---初始化
function DebugClient:ctor()
    self.m_socket = socket
end

---@public
---关闭连接
function DebugClient:close()
    self.m_client:close()
    self.m_client = nil
end

---@public
---连接网络
function DebugClient:connect(ip, port)
    ---@diagnostic disable-next-line: undefined-field
    local tcp = self.m_socket.connect(ip, port)
    if tcp then
        self.m_client = tcp
        return tcp
    end
end

---@public
---是否已连接
function DebugClient:isConnection()
    return self.m_client and true or false
end

---public
---设置超时
function DebugClient:setTimeout(time)
    if not self:isConnection() then
        printErr("The socket is not connected")
        return
    end

    self.m_client:settimeout(time)
end

---@public
---接收数据
---@return NetData
function DebugClient:receive()
    if self.m_client then
        local msg, status = self.m_client:receive()
        if msg then
            return json.decode(msg)
        elseif status == "closed" then
            return "closed"
        end
    end

    return nil
end

---@public
---接收debug模式数据
function DebugClient:receiveDebug()
    if self.m_client then
        local msg, status = self.m_client:receive()
        if msg and msg ~= "" then
            local index = string.find(msg, "Content--Length")
            if index and index ~= -1 then
                msg = msg:sub(1, index - 1)
                if msg == "" then
                    return nil
                end

                return json.decode(msg)
            end
        elseif status == "close" then
            return "close"
        end
    end

    return nil
end

---@public
---发送数据
---@param command Protocol
---@param args table
---@param isSendLength boolean
function DebugClient:sendMsg(command, args, isSendLength)
    -- print(command)
    if not self:isConnection() then
        printErr("The socket is not connected")
        return
    end

    local sendMsg = {
        command = command,
        arguments = args
    }
    xpcall(
        function()
            local sendStr = json.encode(sendMsg) .. "\n"
            self.m_client:send(sendStr)
        end,
        function(msg)
            print(msg, debug.traceback())
        end
    )
end

---@public
---发送调试数据
---@param command Protocol
---@param args table
function DebugClient:sendDebugMsg(command, args)
    if not self:isConnection() then
        printErr("The socket is not connected")
        return
    end

    local sendMsg = {
        type = "request",
        command = command,
        arguments = args
    }
    local sendStr = json.encode(sendMsg) .. "\n"
    sendStr = string.format("Content-Length: %d\r\n\r\n", sendStr:len()) .. sendStr
    self.m_client:send(sendStr)
end

---发送初始化数据
function DebugClient:initialize()
    self:sendDebugMsg(Protocol.debugInitialize, { linesStartAt1 = true, columnsStartAt1 = true, pathFormat = "path" })
end

---附加调试
function DebugClient:attack(host, port)
    self:sendDebugMsg(Protocol.debugAttach, { host = host, port = port })
end

---启动调试
function DebugClient:launch()
    self:sendDebugMsg(Protocol.debugLaunch, nil)
end

---发送控制台打印消息
---@param msg string
---@param type number 类型 0普通 1警告 2错误
function DebugClient:printConsole(msg, type)
    type = type or 0
    local msgTb = {}
    while true do
        msg = Utils.filterSpecChar(msg)
        if msg:len() > 500000 then
            local str = msg:sub(0, 500000)
            local idx = Utils.lastFind(str, "\n")
            if not idx then
                idx = 500000
            end

            table.insert(msgTb, msg:sub(0, idx))
            msg = msg:sub(idx, msg:len())
        else
            table.insert(msgTb, msg)
            break
        end
    end

    for k, v in ipairs(msgTb) do
        self:sendMsg(Protocol.printConsole, { msg = v, type = type })
    end
end

---发送窗口提示消息
---@param msg string
---@param type number 类型 1普通 2警告 3错误
function DebugClient:showDialogMessage(msg, type)
    type = type or 1
    local msgTb = {}
    while true do
        if msg:len() > 500000 then
            local str = msg:sub(0, 500000)
            local idx = Utils.lastFind(str, "\n")
            table.insert(msgTb, msg:sub(0, idx))
            msg = msg:sub(idx, msg:len())
        else
            table.insert(msgTb, msg)
            break
        end
    end

    for k, v in ipairs(msgTb) do
        self:sendMsg(Protocol.showDialogMessage, { msg = v, type = type })
    end
end

---暂停
function DebugClient:pause(stack)
    -- dump(stack, "发起暂停")
    self:sendMsg(Protocol.pause, stack)
end

---继续
function DebugClient:continue()
    self:sendMsg(Protocol.continue)
end

---单步跳过
function DebugClient:next()
    self:sendMsg(Protocol.next)
end

---单步跳入
function DebugClient:stepIn()
    self:sendMsg(Protocol.stepIn)
end

---单步跳出
function DebugClient:stepOut()
    self:sendMsg(Protocol.stepOut)
end

---发送变量域
---@param frameId number
---@param scopeInfo ScopeInfo 变量域数据
function DebugClient:sendScopes(frameId, scopeInfo)
    self:sendMsg(Protocol.getScopes,
        {
            frameId = frameId,
            struct = scopeInfo.struct
        }
    )
end

---发送变量
---@param path string 原发送的变量路径
---@param frameId number 
---@param vars any 变量
---@param tbkey string 表地址
---@param realPath string 真实变量路径
function DebugClient:sendVariable(path, frameId, vars, tbkey, realPath)
    -- dump(vars, "sendVariable")
    self:sendMsg(
        Protocol.getVariable,
        {
            path = path,
            frameId = frameId,
            vars = vars,
            tbkey = tbkey,
            realPath = realPath
        }
    )
end

---发送监视
---@param exp string 原发送的表达式
---@param frameId number
---@param ret any 计算结果
---@param tbkey string table地址
---@param realPath string 真实路径
function DebugClient:sendWatch(exp, frameId, ret, tbkey, realPath)
    self:sendMsg(
        Protocol.watchVariable,
        {
            exp = exp,
            frameId = frameId,
            vars = ret,
            tbkey = tbkey,
            realPath = realPath
        }
    )
end

---发送设置变量
---@param path string
---@param frameId number
---@param var VariableData 最终设置的值
function DebugClient:sendSetVariable(path, frameId, var)
    self:sendMsg(
        Protocol.setVariable,
        {
            path = path,
            frameId = frameId,
            var = var
        }
    )
end

---重置堆栈/异常情况的断点结束
function DebugClient:resetStackInfo()
    self:sendMsg(Protocol.resetStackInfo)
end

return DebugClient
