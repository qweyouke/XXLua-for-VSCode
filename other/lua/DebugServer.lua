---服务端
---anthor: xxiong
---@class DebugServer 
---@field m_socket socket
---@field m_server userdata
---@field m_client userdata
local DebugServer = xxlua_require("DebugClass")("DebugServer")

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
        backlog = backlog or 30

        for i = port, port + 100 do
            ---@diagnostic disable-next-line: undefined-field
            local sock = socket.tcp()
            local res, err = sock:bind("0.0.0.0", i)
            if res and res == 1 then
                res, err = sock:listen(backlog)
                if res and res == 1 then
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
        print(string.format("The client(%s:%d) is ready, wait for debugger's connection", self.m_socket.getAddr(), realPort))
        self.m_server = sock
        self.m_server:settimeout(0)
        return true
    else
        return false
    end
end

function DebugServer:accept()
    if self.m_server then
        if not self.m_client then
            self.m_client = self.m_server:accept()
        end
        return self.m_client
    end
end

function DebugServer:receive()
    if self.m_client then
        local msg, status = self.m_client:receive()
        if msg then
            return json.decode(msg)
        elseif status == "closed" then
            return "closed"
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

    if self.m_client then
        self.m_client:close()
        self.m_client = nil
    end
end

return DebugServer
