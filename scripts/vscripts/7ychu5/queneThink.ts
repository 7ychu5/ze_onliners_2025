import { Instance } from "cs_script/point_script";

export interface ThinkTask {
    time: number;
    callback: () => void;
}

const thinkQueue: ThinkTask[] = [];

/**
 * 将思考任务加入队列
 * @param time 执行时间
 * @param callback 回调函数
 */


export function QueueThink(time: number, callback: () => void) {
    const indexAfter = thinkQueue.findIndex((t) => t.time > time);
    if (indexAfter === -1) {
        thinkQueue.push({ time, callback });
        return;
    }

    thinkQueue.splice(indexAfter, 0, { time, callback });
    Instance.SetNextThink(time);
}

/**
 * 运行思考队列中的所有到期任务
 */
export function RunThinkQueue(): void {
    const upperThinkTime = Instance.GetGameTime() + 1 / 128;
    
    while (thinkQueue[0] !== undefined && thinkQueue.length > 0 && thinkQueue[0].time <= upperThinkTime) {
        const task = thinkQueue.shift();
        if (task) {
            task.callback();
        }
    }
    
    if (thinkQueue.length > 0) {
        if(thinkQueue[0] == undefined) return
        Instance.SetNextThink(thinkQueue[0].time);
    }
}

/**
 * 延迟执行（返回 Promise）
 * @param delay 延迟时间（秒）
 * @returns Promise 在延迟后解析
 */
export function Delay(delay: number): Promise<void> {
    return new Promise((resolve) => 
        QueueThink(Instance.GetGameTime() + delay, resolve)
    );
}

// // 设置主思考循环
// export function InitThinkQueue(): void {
//     Instance.SetThink(() => {RunThinkQueue();});
// }