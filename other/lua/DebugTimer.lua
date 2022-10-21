--class为之前写的面向对象类
local TimeSystem = xxlua_require("DebugClass") ("TimeSystem")
local GameUpdater = xxlua_require("GameUpdater")

--单例
TimeSystem.Instance = function()
    if (TimeSystem.m_instance == nil) then
        TimeSystem.m_instance = TimeSystem.new()
    end

    return TimeSystem.m_instance
end

function TimeSystem:ctor()
    GameUpdater.AddFixedUpdate(function(...) self:Update(...) end)
    --事件池
    self.TimerDict = {}
    self.timerIndex = 1
end

--参数：时间间隔、循环几次、回调函数、回调对象、回调参数
function TimeSystem:AddTimer(callBack, delta, loopTimes, param)
    if callBack == nil then
        return
    end

    self.TimerDict[self.timerIndex] = {
        leftTime = delta or 1,
        delta = delta or 1,
        loopTimes = loopTimes or -1,
        callBack = callBack,
        param = param,
        timerIndex = self.timerIndex
    }
    self.timerIndex = self.timerIndex + 1

    return self.timerIndex - 1
end

function TimeSystem:RemoveTimer(timerIndex)
    if timerIndex == nil then
        return
    end

    self.TimerDict[timerIndex] = nil
end

--让这个函数被Unity的Update每帧调用
--timeInterval：时间间隔
--每帧都调用函数，但不是每帧都遍历一次字典，不然太耗性能
--可以设置为0.1，一般延迟调用时间也不会太短
function TimeSystem:Update(timeInterval)
    --遍历字典，更新剩余时间，时间到了就执行函数
    for k, v in pairs(self.TimerDict) do
        v.leftTime = v.leftTime - timeInterval

        if v.leftTime <= 0 then

            if v.callBack then
                v.callBack(v.param)
            end

            v.leftTime = v.delta

            if v.loopTimes >= 0 then
                v.loopTimes = v.loopTimes - 1
                if v.loopTimes <= 0 then
                    v.callBack = nil
                    self:RemoveTimer(v.timerIndex)
                end
            end
        end
    end
end

function TimeSystem:Clear()
    self.TimerDict = {}
end

return TimeSystem
