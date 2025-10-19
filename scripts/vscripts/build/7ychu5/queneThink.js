// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

const thinkQueue = [];
function QueueThink(time, callback) {
    const indexAfter = thinkQueue.findIndex((t) => t.time > time);
    if (indexAfter === -1) {
        thinkQueue.push({ time, callback });
        return;
    }
    thinkQueue.splice(indexAfter, 0, { time, callback });
    Instance.SetNextThink(time);
}
function RunThinkQueue() {
    const upperThinkTime = Instance.GetGameTime() + 1 / 128;
    while (thinkQueue[0] !== undefined && thinkQueue.length > 0 && thinkQueue[0].time <= upperThinkTime) {
        const task = thinkQueue.shift();
        if (task) {
            task.callback();
        }
    }
    if (thinkQueue.length > 0) {
        if (thinkQueue[0] == undefined)
            return;
        Instance.SetNextThink(thinkQueue[0].time);
    }
}
function Delay(delay) {
    return new Promise((resolve) => QueueThink(Instance.GetGameTime() + delay, resolve));
}

export { Delay, QueueThink, RunThinkQueue };
