// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

const utils = {
    printl(a) { Instance.Msg(a); },
    EntFire(name = "", input = "", value = "", delay = 0.0, caller = undefined, activator = undefined) {
        Instance.EntFireAtName({ name, input, value, delay, caller, activator });
    },
    EntFireByHandle(target, input = "", value = "", delay = 0.0, caller = undefined, activator = undefined) {
        if (target == undefined)
            return;
        Instance.EntFireAtTarget({ target, input, value, delay, caller, activator });
    },
    GetRandomIntBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    vectorAdd(vec1, vec2) {
        return { x: vec1.x + vec2.x, y: vec1.y + vec2.y, z: vec1.z + vec2.z };
    },
    vectorScale(vec, scale) {
        return { x: vec.x * scale, y: vec.y * scale, z: vec.z * scale };
    },
    vectorDistance(vec) {
        return Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.y, 2) + Math.pow(vec.z, 2));
    },
    dotProduct(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    },
    normalizeVector(v) {
        const length = this.vectorDistance(v);
        if (length === 0)
            return { x: 0, y: 0, z: 0 };
        return { x: v.x / length, y: v.y / length, z: v.z / length };
    },
    angleToVector(angles) {
        const pitch = (angles.pitch * Math.PI) / 180;
        const yaw = (angles.yaw * Math.PI) / 180;
        return {
            x: Math.cos(yaw) * Math.cos(pitch),
            y: Math.sin(yaw) * Math.cos(pitch),
            z: -Math.sin(pitch)
        };
    }
};

class DashAbility {
    constructor(playerId, getPlayerPawn, getPlayerCrouch) {
        this.name = "冲刺";
        this.version = "1.0.0";
        this.lastDashTime = 0;
        this.wasCrouching = false;
        this.playerId = playerId;
        this.getPlayerPawn = getPlayerPawn;
        this.getPlayerCrouch = getPlayerCrouch;
        this.config = {
            enabled: true,
            dashPower: 666,
            checkInterval: 0.1,
            cooldown: 2.0
        };
    }
    initialize() {
        utils.printl(`冲刺能力已为玩家 ${this.playerId} 初始化`);
    }
    update() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        if (currentTime - this.lastDashTime < (this.config.cooldown || 0))
            return;
        if (this.canDash()) {
            this.executeDash();
        }
        this.wasCrouching = this.getPlayerCrouch();
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 冲刺能力已清理`);
    }
    onPlayerReset() {
    }
    onPlayerDisconnect() {
        this.cleanup();
    }
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    getConfig() {
        return Object.assign({}, this.config);
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
    canDash() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return false;
        if (pawn.GetGroundEntity() !== undefined)
            return false;
        const isCrouching = this.getPlayerCrouch();
        return isCrouching && !this.wasCrouching;
    }
    executeDash() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentVelocity = pawn.GetAbsVelocity();
        const horizontalVelocity = {
            x: currentVelocity.x,
            y: currentVelocity.y,
            z: 0
        };
        const speed = Math.sqrt(horizontalVelocity.x * horizontalVelocity.x +
            horizontalVelocity.y * horizontalVelocity.y);
        let dashDirection;
        if (speed < 10) {
            const eyeAngles = pawn.GetEyeAngles();
            dashDirection = utils.angleToVector(eyeAngles);
            dashDirection.z = 0;
            dashDirection = utils.normalizeVector(dashDirection);
        }
        else {
            dashDirection = utils.normalizeVector(horizontalVelocity);
        }
        const dashVelocity = {
            x: dashDirection.x * this.config.dashPower,
            y: dashDirection.y * this.config.dashPower,
            z: currentVelocity.z
        };
        pawn.Teleport({ velocity: dashVelocity });
        this.lastDashTime = Instance.GetGameTime();
        this.createDashEffects();
        utils.printl(`玩家 ${this.playerId} 使用冲刺`);
    }
    createDashEffects() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 30,
            duration: 0.5,
            color: { r: 255, g: 100, b: 0, a: 200 }
        });
        const currentVelocity = pawn.GetAbsVelocity();
        const direction = utils.normalizeVector(currentVelocity);
        const endPos = {
            x: playerPos.x + direction.x * 100,
            y: playerPos.y + direction.y * 100,
            z: playerPos.z + direction.z * 50
        };
        Instance.DebugLine({
            start: playerPos,
            end: endPos,
            duration: 0.5,
            color: { r: 255, g: 150, b: 0, a: 255 }
        });
    }
}

export { DashAbility };
