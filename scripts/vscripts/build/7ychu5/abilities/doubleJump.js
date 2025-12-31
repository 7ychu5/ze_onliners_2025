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

const DoubleJumpState = {
    READY: 0,
    COOLDOWN: 1,
    USED: 2
};
class DoubleJumpAbility {
    constructor(playerId, getPlayerPawn, getPlayerCrouch) {
        this.name = "二段跳";
        this.version = "1.0.0";
        this.state = DoubleJumpState.READY;
        this.lastJumpTime = 0;
        this.wasCrouching = false;
        this.wasInAir = false;
        this.playerId = playerId;
        this.getPlayerPawn = getPlayerPawn;
        this.getPlayerCrouch = getPlayerCrouch;
        this.config = {
            enabled: true,
            jumpPower: 300,
            jumpCooldown: 1.0,
            enableEffect: true
        };
    }
    initialize() {
        utils.printl(`双跳能力已为玩家 ${this.playerId} 初始化`);
    }
    update() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        const isInAir = pawn.GetGroundEntity() === undefined;
        const isCrouching = this.getPlayerCrouch();
        if (!this.wasInAir && isInAir) {
            this.state = DoubleJumpState.READY;
        }
        if (this.state === DoubleJumpState.READY &&
            isInAir &&
            isCrouching &&
            !this.wasCrouching) {
            this.executeDoubleJump();
        }
        if (this.state === DoubleJumpState.COOLDOWN &&
            currentTime - this.lastJumpTime >= this.config.jumpCooldown) {
            this.state = DoubleJumpState.READY;
        }
        this.wasCrouching = isCrouching;
        this.wasInAir = isInAir;
        this.updateDoubleJumpUI();
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 双跳能力已清理`);
    }
    onPlayerReset() {
        this.state = DoubleJumpState.READY;
        this.lastJumpTime = 0;
        this.wasCrouching = false;
        this.wasInAir = false;
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
    getState() {
        return this.state;
    }
    isReady() {
        return this.state === DoubleJumpState.READY;
    }
    executeDoubleJump() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        const currentVelocity = pawn.GetAbsVelocity();
        const newVelocity = {
            x: currentVelocity.x,
            y: currentVelocity.y,
            z: this.config.jumpPower
        };
        pawn.Teleport({ velocity: newVelocity });
        this.state = DoubleJumpState.COOLDOWN;
        this.lastJumpTime = currentTime;
        if (this.config.enableEffect) {
            this.createDoubleJumpEffects();
        }
        utils.printl(`玩家 ${this.playerId} 使用双跳`);
    }
    createDoubleJumpEffects() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 32,
            duration: 0.5,
            color: { r: 0, g: 200, b: 255, a: 150 }
        });
        this.createJumpParticles(playerPos);
    }
    createJumpParticles(position) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const endPos = {
                x: position.x + Math.cos(angle) * 50,
                y: position.y + Math.sin(angle) * 50,
                z: position.z - 20
            };
            Instance.DebugLine({
                start: position,
                end: endPos,
                duration: 0.3,
                color: { r: 100, g: 200, b: 255, a: 200 }
            });
        }
    }
    updateDoubleJumpUI() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        const cooldownRemaining = Math.max(0, this.config.jumpCooldown - (currentTime - this.lastJumpTime));
        let statusText = "";
        let statusColor = { r: 0, g: 255, b: 0, a: 255 };
        switch (this.state) {
            case DoubleJumpState.READY:
                statusText = "双跳: 就绪";
                statusColor = { r: 0, g: 255, b: 0, a: 255 };
                break;
            case DoubleJumpState.COOLDOWN:
                statusText = `双跳: 冷却中 (${cooldownRemaining.toFixed(1)}s)`;
                statusColor = { r: 255, g: 150, b: 0, a: 255 };
                break;
            case DoubleJumpState.USED:
                statusText = "双跳: 已使用";
                statusColor = { r: 255, g: 0, b: 0, a: 255 };
                break;
        }
        const isInAir = pawn.GetGroundEntity() === undefined;
        if (isInAir) {
            Instance.DebugScreenText({
                text: statusText,
                x: 0.1,
                y: 0.8 + (this.playerId * 0.03),
                duration: 0.1,
                color: statusColor
            });
        }
    }
    forceReset() {
        this.state = DoubleJumpState.READY;
        this.lastJumpTime = 0;
    }
    getDebugInfo() {
        const stateNames = ["就绪", "冷却中", "已使用"];
        return `双跳状态: ${stateNames[this.state]}, 冷却剩余: ${Math.max(0, this.config.jumpCooldown - (Instance.GetGameTime() - this.lastJumpTime)).toFixed(1)}s`;
    }
}

export { DoubleJumpAbility };
