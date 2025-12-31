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

class ClimbingAbility {
    constructor(playerId, getPlayerPawn) {
        this.name = "攀附";
        this.version = "1.0.0";
        this.lastClimbTime = 0;
        this.playerId = playerId;
        this.getPlayerPawn = getPlayerPawn;
        this.config = {
            enabled: true,
            climbPower: 300,
            forwardPower: 150,
            traceDistance: 32,
            checkInterval: 0.1,
            cooldown: 1.0
        };
    }
    initialize() {
        utils.printl(`爬墙能力已为玩家 ${this.playerId} 初始化`);
    }
    update() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        if (currentTime - this.lastClimbTime < (this.config.cooldown || 0))
            return;
        if (this.canClimb()) {
            this.executeClimb();
        }
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 爬墙能力已清理`);
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
    canClimb() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return false;
        if (pawn.GetGroundEntity() !== undefined)
            return false;
        const playerPos = pawn.GetAbsOrigin();
        const eyeAngles = pawn.GetEyeAngles();
        const headPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z + 72 };
        const chestPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z + 48 };
        const eyeVector = utils.angleToVector(eyeAngles);
        const direction = utils.normalizeVector(eyeVector);
        const headEnd = {
            x: headPos.x + direction.x * this.config.traceDistance,
            y: headPos.y + direction.y * this.config.traceDistance,
            z: headPos.z + direction.z * this.config.traceDistance
        };
        const chestEnd = {
            x: chestPos.x + direction.x * this.config.traceDistance,
            y: chestPos.y + direction.y * this.config.traceDistance,
            z: chestPos.z + direction.z * this.config.traceDistance
        };
        const headTrace = Instance.TraceLine({
            start: headPos,
            end: headEnd,
            ignoreEntity: pawn,
            ignorePlayers: false
        });
        const chestTrace = Instance.TraceLine({
            start: chestPos,
            end: chestEnd,
            ignoreEntity: pawn,
            ignorePlayers: false
        });
        return !headTrace.didHit && chestTrace.didHit;
    }
    executeClimb() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const eyeAngles = pawn.GetEyeAngles();
        const direction = utils.angleToVector(eyeAngles);
        const normalizedDir = utils.normalizeVector(direction);
        const climbVelocity = {
            x: normalizedDir.x * this.config.forwardPower,
            y: normalizedDir.y * this.config.forwardPower,
            z: this.config.climbPower
        };
        pawn.Teleport({ velocity: climbVelocity });
        this.lastClimbTime = Instance.GetGameTime();
        utils.printl(`玩家 ${this.playerId} 触发爬墙`);
    }
}

export { ClimbingAbility };
