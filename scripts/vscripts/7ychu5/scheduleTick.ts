import { Instance } from "cs_script/point_script";

const onTicks: (() => void)[] = [];
let delayActions: Array<{targetTime: number, resolve: () => void}> = [];

export function tickCallback() {
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

export function scheduleTick(callback: () => void) {
    onTicks.push(callback);
}

export function delay(seconds:number): Promise<void> {
    const targetTime = Instance.GetGameTime() + seconds;
    return new Promise((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}