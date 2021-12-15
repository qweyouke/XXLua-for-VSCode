---服务端
---anthor: xxiong
---@class DebugServer 
---@field m_socket socket
---@field m_server userdata
local DebugServer = xxlua_require("DebugClass") ("DebugServer")

---@class socket socket本体
local socket = require("socket.core")

---@type json
local json = xxlua_require("DebugJson")
---@type proto
local proto = xxlua_require("DebugProto")

---@private
---创建socket
local function createSocket()
    local _M = socket

    ---@public
    ---获取ip
    function _M.getAddr()
        ---@diagnostic disable-next-line: undefined-field
        local addr = socket.dns.toip(socket.dns.gethostname())
        return addr
    end

    ---@public
    ---创建服务器
    function _M.bind(port, backlog)

        port = port or 8896
        backlog = backlog or 30

        for i = port, port + 1000 do
            local isBreak = true
            ---@diagnostic disable-next-line: undefined-field
            local sock = socket.tcp()
            local res, err = sock:bind("0.0.0.0", i)
            if res then
                res, err = sock:listen(backlog)
                if res then
                    return sock, i
                else
                    printWarn("listen failed, " .. err .. ".", i, backlog)
                    sock:close()
                end
            else
                printWarn("bind failed, " .. err .. ".", i)
                sock:close()
            end
        end

        printErr("No useful port found.")
        return nil
    end

    return _M
end

---初始化
function DebugServer:ctor()
    self.m_socket = createSocket()
end

---@public
---创建服务
function DebugServer:createServer(port)
    local sock, realPort = self.m_socket.bind(port)
    if sock then
        print(string.format("The client(%d) is ready, wait for debugger's connection", realPort))
        self.m_server = sock
        self.m_server:settimeout(0)
        return true
    else
        return false
    end
end

---@public
---检测连接
function DebugServer:accept()
    if self.m_server then
        local client = self.m_server:accept()
        if client then
            client:close()
            return true
        end
    end
end

---@public
---关闭连接
function DebugServer:close()
    if self.m_server then
        self.m_server:close()
        self.m_server = nil
    end
end

return DebugServer
