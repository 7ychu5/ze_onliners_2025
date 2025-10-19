// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

const onTicks = [];
let delayActions = [];
function tickCallback() {
    for (const cb of onTicks) {
        cb();
    }
    delayActions = delayActions.filter(act => {
        if (act.targetTime > Instance.GetGameTime())
            return true;
        act.resolve();
        return false;
    });
}
function scheduleTick(callback) {
    onTicks.push(callback);
}
function delay(seconds) {
    const targetTime = Instance.GetGameTime() + seconds;
    return new Promise((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}

export { delay, scheduleTick, tickCallback };
