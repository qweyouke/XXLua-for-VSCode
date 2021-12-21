---@diagnostic disable: doc-field-no-class, duplicate-doc-field
---协议
---anthor: xxiong

--debug模式初始化参数
---@class DebugInitializeArgs
---@field linesStartAt1 boolean
---@field columnsStartAt1 boolean
---@field pathFormat string
local DebugInitializeArgs
--------------------------------------------
---@class S2C_InitializeArgs
---@field name string
---@field type string
---@field request string
---@field clientHost string 客户端地址 
---@field port number 调试器的端口
---@field printType number print打印方式 1 控制台和系统输出,2 控制台输出,3 系统输出
---@field externalVariables string[] 附加变量名列表 (如：查看变量时指向子类可直接查看父类数据，或查看元表二次、多次封装的数据)
---@field filterFiles string[] 过滤文件列表, 以下文件不会进入断点
---@field __configurationTarget number 
---@field __sessionId string
local S2C_InitializeArgs
--------------------------------------------
---@class BreakInfo
---@field fullPath string
---@field line number
---@field condition string
---@field hitCondition string
---@field logMessage string
local BreakInfo

--设置断点参数
---@class S2C_SetBreakpointsArgs
---@field breakPoints BreakInfo[]
local S2C_SetBreakpointsArgs
--------------------------------------------

---打印消息到控制台
---@class C2S_PrintConsoleArgs
---@field msg string
---@field type number 1正常 2警告 3错误
local C2S_PrintConsoleArgs

---获取变量域
---@class S2C_getScopes
---@field frameId number 堆栈索引
local S2C_getScopes

---变量域变量结构
---@class ScopeInfoVariableStruct
---@field locals table 局部变量
---@field ups table 上层变量(闭包时才有)
---@field global table 全局变量
---@field watch table 监视变量
---@field invalid table
local ScopeInfoVariableStruct
---变量域信息
---@class ScopeInfo
---@field struct ScopeInfoVariableStruct 变量结构
local ScopeInfo

---获取变量
---@class S2C_getVariable
---@field path string 变量table路径
---@field frameId number 堆栈索引
local S2C_getVariable

---监视变量
---@class S2C_watchVariable
---@field exp string 表达式 lua语法
---@field frameId number 堆栈索引
local S2C_watchVariable

--重载lua文件
---@class S2C_ReloadLuaArgs
---@field luaPath string lua路径
---@field fullPath string 绝对路径
local S2C_ReloadLuaArgs

--显示窗口信息
---@class C2S_ShowDialogMessage
---@field msg string
local C2S_ShowDialogMessage

--C# 值信息
---@class CSharp_ValueInfo
---@field _key string
---@field _value any
---@field _valueStr string
---@field _valueType string
---@field _tbkey string
local CSharp_ValueInfo

---@class StackInfo 堆栈信息
---@field fileName string 文件名
---@field filePath string 文件相对路径
---@field currentline number 当前行
---@field linedefined number 函数开始行
---@field lastlinedefined number 函数结束行
---@field functionName string 函数名
---@field func function 函数
---@field vars ScopeInfoVariableStruct 引用变量
local StackInfo

---@class VariableData
---@field type string 变量类型
---@field var string 变量值
local VariableData

---设置host
---@class S2C_StartDebug
---@field host string
---@field port number

---@class proto
local proto = {
    -------------------------debug模式-------------------------
    --初始化
    ---@field args DebugInitializeArgs
    debugInitialize = "initialize",
    --"启动"调试
    debugLaunch = "launch",
    --"附加"调试
    debugAttach = "attach",
    ----------------------------------------------------------
    --初始化
    ---@field args S2C_InitializeArgs
    initialize = "initialize",
    --断开连接
    disconnect = "disconnect",
    --设置断点
    ---@field args S2C_SetBreakpointsArgs
    setBreakpoints = "setBreakpoints",
    --暂停
    pause = "pause",
    --继续
    continue = "continue",
    --单步跳过
    next = "next",
    --单步跳入
    stepIn = "stepIn",
    --单步跳出
    stepOut = "stepOut",
    --停止
    stop = "stop",
    --获取变量域
    ---@field args S2C_getScopes
    getScopes = "getScopes",
    --获取变量
    getVariable = "getVariable",
    --监视变量
    watchVariable = "watchVariable",
    --打印到控制台
    ---@field args C2S_PrintConsoleArgs
    printConsole = "printConsole",
    --重载lua文件
    ---@field args S2C_ReloadLuaArgs
    reloadLua = "reloadLua",
    --显示窗口信息
    ---@field args C2S_ShowDialogMessage
    showDialogMessage = "showDialogMessage",
    --重置堆栈信息
    resetStackInfo = "resetStackInfo",
    --开始调试
    startDebug = "startDebug"
}

return proto
