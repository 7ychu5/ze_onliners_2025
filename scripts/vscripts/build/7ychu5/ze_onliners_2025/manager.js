// s2ts v0.6.1
import { Instance, BaseModelEntity } from 'cs_script/point_script';

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
function delay(seconds) {
    const targetTime = Instance.GetGameTime() + seconds;
    return new Promise((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}

class AbilityManager {
    constructor(playerId) {
        this.playerId = playerId;
        this.abilities = new Map();
    }
    registerAbility(ability) {
        if (this.abilities.has(ability.name)) {
            utils.printl(`玩家 ${this.playerId} 能力 ${ability.name} 已存在，跳过注册`);
            return;
        }
        this.abilities.set(ability.name, ability);
        ability.initialize();
        utils.printl(`玩家 ${this.playerId} 注册能力: ${ability.name} v${ability.version}`);
    }
    unregisterAbility(abilityName) {
        const ability = this.abilities.get(abilityName);
        if (ability) {
            ability.cleanup();
            this.abilities.delete(abilityName);
            utils.printl(`玩家 ${this.playerId} 注销能力: ${abilityName}`);
        }
    }
    getAbility(abilityName) {
        return this.abilities.get(abilityName);
    }
    updateAll() {
        for (const ability of this.abilities.values()) {
            try {
                ability.update();
            }
            catch (error) {
                utils.printl(`玩家 ${this.playerId} 能力 ${ability.name} 更新错误: ${error}`);
            }
        }
    }
    onPlayerReset() {
        for (const ability of this.abilities.values()) {
            ability.onPlayerReset();
        }
    }
    onPlayerDisconnect() {
        for (const ability of this.abilities.values()) {
            ability.onPlayerDisconnect();
        }
    }
    getAbilityNames() {
        return Array.from(this.abilities.keys());
    }
    cleanupAll() {
        for (const ability of this.abilities.values()) {
            ability.cleanup();
        }
        this.abilities.clear();
    }
}

const GrappleState = {
    INACTIVE: 0,
    FIRING: 1,
    ATTACHED: 2
};
class GrappleAbility {
    constructor(playerId, getPlayerPawn, getPlayerCrouch) {
        this.name = "钩爪";
        this.version = "1.0.0";
        this.state = GrappleState.INACTIVE;
        this.grappleStartTime = 0;
        this.grapplePoint = null;
        this.lastGrappleTime = 0;
        this.lastAutoCheckTime = 0;
        this.playerId = playerId;
        this.getPlayerPawn = getPlayerPawn;
        this.getPlayerCrouch = getPlayerCrouch;
        this.config = {
            enabled: true,
            speed: 300,
            maxDistance: 1500,
            cooldown: 2.0,
            maxAngle: 120,
            minDistance: 64,
            playerSpeedMultiplier: 1.8,
            grappleSpeedMultiplier: 0.8,
            autoGrappleCheckInterval: 0.1
        };
    }
    initialize() {
        utils.printl(`钩爪能力已为玩家 ${this.playerId} 初始化`);
    }
    update() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const currentTime = Instance.GetGameTime();
        if (this.state === GrappleState.INACTIVE) {
            this.checkAutoGrapple(currentTime);
        }
        switch (this.state) {
            case GrappleState.FIRING:
                if (currentTime - this.grappleStartTime > 2.0) {
                    this.detachGrapple();
                }
                break;
            case GrappleState.ATTACHED:
                this.updateGrappleMovement();
                this.updateGrappleEffects();
                this.checkGrappleConditions();
                break;
        }
    }
    cleanup() {
        this.detachGrapple();
        utils.printl(`玩家 ${this.playerId} 钩爪能力已清理`);
    }
    onPlayerReset() {
        this.detachGrapple();
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
        if (!enabled) {
            this.detachGrapple();
        }
    }
    forceDetach() {
        this.detachGrapple();
    }
    getState() {
        return this.state;
    }
    isActive() {
        return this.state === GrappleState.ATTACHED;
    }
    checkAutoGrapple(currentTime) {
        if (currentTime - this.lastGrappleTime < (this.config.cooldown || 0))
            return;
        if (currentTime - this.lastAutoCheckTime < this.config.autoGrappleCheckInterval)
            return;
        this.lastAutoCheckTime = currentTime;
        if (this.isPlayerInAirAndCrouching()) {
            this.fireGrapple();
        }
    }
    isPlayerInAirAndCrouching() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return false;
        const isInAir = pawn.GetGroundEntity() === undefined;
        const isCrouching = this.getPlayerCrouch();
        return isInAir && isCrouching;
    }
    fireGrapple() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const eyePos = pawn.GetEyePosition();
        const eyeAngles = pawn.GetEyeAngles();
        const direction = utils.angleToVector(eyeAngles);
        const endPos = {
            x: eyePos.x + direction.x * this.config.maxDistance,
            y: eyePos.y + direction.y * this.config.maxDistance,
            z: eyePos.z + direction.z * this.config.maxDistance
        };
        const traceResult = Instance.TraceLine({
            start: eyePos,
            end: endPos,
            ignoreEntity: pawn,
            ignorePlayers: false
        });
        if (traceResult.didHit && traceResult.hitEntity) {
            this.state = GrappleState.ATTACHED;
            this.grapplePoint = traceResult.end;
            this.grappleStartTime = Instance.GetGameTime();
            this.createGrappleEffects(eyePos, this.grapplePoint);
            utils.printl(`玩家 ${this.playerId} 钩爪附着`);
        }
        else {
            this.state = GrappleState.FIRING;
            this.grappleStartTime = Instance.GetGameTime();
        }
        this.lastGrappleTime = Instance.GetGameTime();
    }
    updateGrappleMovement() {
        if (!this.grapplePoint)
            return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const playerPos = pawn.GetAbsOrigin();
        const eyeAngles = pawn.GetEyeAngles();
        const toGrapple = {
            x: this.grapplePoint.x - playerPos.x,
            y: this.grapplePoint.y - playerPos.y,
            z: this.grapplePoint.z - playerPos.z
        };
        const grappleDistance = utils.vectorDistance(toGrapple);
        const grappleDirection = utils.normalizeVector(toGrapple);
        const playerForward = utils.angleToVector(eyeAngles);
        const grappleVelocity = utils.vectorScale(grappleDirection, this.config.speed * this.config.grappleSpeedMultiplier);
        const playerForwardVelocity = utils.vectorScale(playerForward, this.config.speed * this.config.playerSpeedMultiplier);
        const combinedVelocity = {
            x: grappleVelocity.x + playerForwardVelocity.x,
            y: grappleVelocity.y + playerForwardVelocity.y,
            z: grappleVelocity.z + playerForwardVelocity.z
        };
        pawn.Teleport({ velocity: combinedVelocity });
        this.updateGrappleUI(grappleDistance);
    }
    checkGrappleConditions() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid() || !this.grapplePoint)
            return;
        const playerPos = pawn.GetAbsOrigin();
        const toGrapple = {
            x: this.grapplePoint.x - playerPos.x,
            y: this.grapplePoint.y - playerPos.y,
            z: this.grapplePoint.z - playerPos.z
        };
        const grappleDirection = utils.normalizeVector(toGrapple);
        const playerForward = utils.angleToVector(pawn.GetEyeAngles());
        const dotProduct = utils.dotProduct(playerForward, grappleDirection);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
        const distance = utils.vectorDistance(toGrapple);
        if (angle > this.config.maxAngle || distance < this.config.minDistance || pawn.GetGroundEntity() !== undefined) {
            this.detachGrapple();
        }
    }
    detachGrapple() {
        if (this.state !== GrappleState.INACTIVE) {
            this.onGrappleDetach();
        }
        this.state = GrappleState.INACTIVE;
        this.grapplePoint = null;
    }
    createGrappleEffects(startPos, endPos) {
        Instance.DebugLine({
            start: startPos,
            end: endPos,
            duration: 0.1,
            color: { r: 255, g: 200, b: 50, a: 255 }
        });
    }
    updateGrappleEffects() {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid() || !this.grapplePoint)
            return;
        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: playerPos,
            end: this.grapplePoint,
            duration: 0.1,
            color: { r: 255, g: 200, b: 50, a: 255 }
        });
    }
    updateGrappleUI(distance) {
    }
    onGrappleDetach() {
    }
}

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

const INT_MAX = 2147483647;
const WorldOrigin = { x: 0, y: 0, z: 0 };
const C = {
    INT_MAX, WorldOrigin
};

class LifeStealBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "吸血";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            lifeStealChance: 0.3,
            lifeStealRatio: 0.1,
            maxHealthLimit: C.INT_MAX,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`吸血能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnPlayerDamage((event) => {
            if (this.config.enabled) {
                this.onPlayerDamage(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 吸血能力已清理`);
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
    onPlayerDamage(event) {
        const attacker = event.attacker;
        event.player;
        const damage = event.damage;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.lifeStealChance)
            return;
        const lifeStealAmount = Math.floor(damage * this.config.lifeStealRatio);
        if (lifeStealAmount <= 0)
            return;
        this.applyLifeSteal(lifeStealAmount);
        this.createLifeStealEffects(attacker, lifeStealAmount);
        utils.printl(`玩家 ${this.playerId} 吸血: +${lifeStealAmount} HP (${this.config.lifeStealRatio * 100}% 伤害)`);
    }
    applyLifeSteal(lifeStealAmount) {
        const player = this.getPlayer();
        if (!player)
            return;
        const currentHP = player.getHP();
        const maxHP = player.getHPMAX();
        if (currentHP < maxHP) {
            const newHealth = Math.min(currentHP + lifeStealAmount, maxHP);
            player.setHP(newHealth);
        }
        else {
            const newMaxHealth = Math.min(maxHP + lifeStealAmount, this.config.maxHealthLimit);
            if (newMaxHealth > maxHP) {
                player.setHPMAX(newMaxHealth);
                player.setHP(newMaxHealth);
                utils.printl(`玩家 ${this.playerId} 最大生命值提升: ${maxHP} -> ${newMaxHealth} (增加 ${lifeStealAmount})`);
            }
        }
    }
    createLifeStealEffects(attacker, lifeStealAmount) {
        const playerPos = attacker.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `吸血 +${lifeStealAmount} HP`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 50, b: 50, a: 255 }
        });
        this.createLifeStealParticles(playerPos);
    }
    createLifeStealParticles(position) {
        for (let i = 0; i < 5; i++) {
            const offset = {
                x: (Math.random() - 0.5) * 30,
                y: (Math.random() - 0.5) * 30,
                z: Math.random() * 20
            };
            const particlePos = {
                x: position.x + offset.x,
                y: position.y + offset.y,
                z: position.z + offset.z
            };
            Instance.DebugSphere({
                center: particlePos,
                radius: 3,
                duration: 0.5,
                color: { r: 255, g: 0, b: 0, a: 200 }
            });
        }
    }
    getHealthInfo() {
        const player = this.getPlayer();
        if (!player)
            return { hp: 0, hpmax: 0 };
        return {
            hp: player.getHP(),
            hpmax: player.getHPMAX()
        };
    }
}

class ExplosiveBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "爆炸子弹";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            explosionChance: 0.2,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`爆炸子弹能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnBulletImpact((event) => {
            if (this.config.enabled) {
                this.onBulletImpact(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 爆炸子弹能力已清理`);
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
    onBulletImpact(event) {
        const weapon = event.weapon;
        const position = event.position;
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.explosionChance)
            return;
        this.createExplosion(position);
        utils.printl(`玩家 ${this.playerId} 触发爆炸子弹`);
    }
    createExplosion(position) {
        const template = Instance.FindEntityByName("template_explosive");
        if (!template) {
            utils.printl("警告: 未找到爆炸模板 template_explosive");
            return;
        }
        const spawned = template.ForceSpawn(position);
        if (spawned && spawned.length > 0) {
            const explosionEntity = spawned[0];
            utils.EntFireByHandle(explosionEntity, "Explode");
        }
    }
}

class RicochetBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "弹射子弹";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            ricochetChance: 0.7,
            damageRatio: 0.5,
            searchRadius: 256,
            maxTargets: 3,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`跳弹子弹能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnBulletImpact((event) => {
            if (this.config.enabled) {
                this.onBulletImpact(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 跳弹子弹能力已清理`);
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
    onBulletImpact(event) {
        const weapon = event.weapon;
        const position = event.position;
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.ricochetChance)
            return;
        const weaponData = weapon.GetData();
        if (!weaponData)
            return;
        const baseDamage = weaponData.GetDamage();
        const ricochetDamage = Math.floor(baseDamage * this.config.damageRatio);
        const targets = this.findTargets(position);
        this.applyRicochetDamage(position, targets, ricochetDamage, weapon);
        utils.printl(`玩家 ${this.playerId} 触发跳弹子弹，击中 ${targets.length} 个目标`);
    }
    findTargets(impactPosition) {
        const player = this.getPlayer();
        if (!player)
            return [];
        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid())
            return [];
        const allPlayers = Instance.FindEntitiesByClass("player");
        const targets = [];
        for (const targetPlayer of allPlayers) {
            if (!targetPlayer.IsValid() ||
                targetPlayer === attacker) {
                continue;
            }
            const distance = this.getDistance(impactPosition, targetPlayer.GetAbsOrigin());
            if (distance <= this.config.searchRadius) {
                targets.push(targetPlayer);
                if (targets.length >= this.config.maxTargets) {
                    break;
                }
            }
        }
        return targets;
    }
    applyRicochetDamage(impactPosition, targets, damage, weapon) {
        const player = this.getPlayer();
        if (!player)
            return;
        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid())
            return;
        for (const target of targets) {
            if (!target.IsValid())
                continue;
            const damageInfo = {
                damage: damage,
                inflictor: attacker,
                attacker: attacker,
                weapon: weapon
            };
            target.TakeDamage(damageInfo);
            this.createRicochetEffect(impactPosition, utils.vectorAdd(target.GetAbsOrigin(), { x: 0, y: 0, z: 48 }));
            this.createDamageIndicator(target.GetAbsOrigin(), damage);
        }
    }
    createRicochetEffect(startPos, endPos) {
        Instance.DebugLine({
            start: startPos,
            end: endPos,
            duration: 1.0,
            color: { r: 0, g: 200, b: 255, a: 255 }
        });
        Instance.DebugSphere({
            center: startPos,
            radius: 10,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 200 }
        });
        Instance.DebugSphere({
            center: endPos,
            radius: 8,
            duration: 1.0,
            color: { r: 0, g: 100, b: 255, a: 200 }
        });
    }
    createDamageIndicator(position, damage) {
        Instance.DebugScreenText({
            text: damage.toString(),
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 255 }
        });
    }
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

class StealMarkAbility {
    constructor(playerId, getPlayer) {
        this.name = "行窃标记";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            stealAmount: 100,
            searchRadius: 128,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`行窃标记能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnPlayerPing((event) => {
            if (this.config.enabled) {
                this.onPlayerPing(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 行窃标记能力已清理`);
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
    onPlayerPing(event) {
        const player = event.player;
        const position = event.position;
        if (!player || player !== this.getPlayer().getController())
            return;
        const target = this.findNearestPlayer(position);
        if (!target) {
            utils.printl(`玩家 ${this.playerId} 标记位置附近没有找到目标`);
            return;
        }
        this.executeSteal(player, target);
        utils.printl(`玩家 ${this.playerId} 对玩家 ${target.GetEntityName()} 使用行窃标记`);
    }
    findNearestPlayer(position) {
        const allPlayers = Instance.FindEntitiesByClass("player");
        let nearestPlayer = null;
        let minDistance = this.config.searchRadius;
        for (const player of allPlayers) {
            if (!player.IsValid() || player === this.getPlayer().getPawn())
                continue;
            const distance = this.getDistance(position, player.GetAbsOrigin());
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        }
        return nearestPlayer;
    }
    executeSteal(attacker, victim) {
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }
        attacker = attacker.GetPlayerPawn();
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.stealAmount.toString(), 0.00, undefined, undefined);
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.stealAmount.toString(), 0.00, undefined, victim);
        utils.EntFireByHandle(gameMoney, "AddMoneyPlayer", "", 0.00, undefined, attacker);
        this.createStealEffects(attacker.GetAbsOrigin(), victim.GetAbsOrigin());
    }
    createStealEffects(attackerPos, victimPos) {
        Instance.DebugLine({
            start: victimPos,
            end: attackerPos,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
        Instance.DebugSphere({
            center: victimPos,
            radius: 20,
            duration: 2.0,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugSphere({
            center: attackerPos,
            radius: 20,
            duration: 2.0,
            color: { r: 0, g: 255, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `行窃 +$${this.config.stealAmount}`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

class DamageModifierSystem {
    constructor() {
        this.modifiers = [];
        this.debugEnabled = true;
        Instance.OnBeforePlayerDamage((event) => {
            return this.processDamageModifiers(event);
        });
    }
    registerModifier(name, priority, modifier) {
        this.unregisterModifier(name);
        this.modifiers.push({ name, priority, modifier });
        this.modifiers.sort((a, b) => b.priority - a.priority);
        if (this.debugEnabled) {
            utils.printl(`注册伤害修改器: ${name} (优先级: ${priority})`);
        }
    }
    unregisterModifier(name) {
        const initialCount = this.modifiers.length;
        this.modifiers = this.modifiers.filter(m => m.name !== name);
        if (this.debugEnabled && initialCount !== this.modifiers.length) {
            utils.printl(`注销伤害修改器: ${name}`);
        }
    }
    setDebugEnabled(enabled) {
        this.debugEnabled = enabled;
        utils.printl(`伤害修改系统调试模式: ${enabled ? '开启' : '关闭'}`);
    }
    processDamageModifiers(event) {
        let modifiedEvent = Object.assign({}, event);
        let finalDamage = event.damage;
        if (!this.debugEnabled || this.modifiers.length === 0) {
            return { damage: finalDamage };
        }
        const debugSteps = [];
        debugSteps.push({
            modifierName: "初始伤害",
            beforeDamage: event.damage,
            afterDamage: event.damage,
            description: "基础伤害值"
        });
        for (const modifier of this.modifiers) {
            try {
                const beforeDamage = modifiedEvent.damage;
                const result = modifier.modifier(modifiedEvent);
                if (result && result.damage !== undefined) {
                    finalDamage = result.damage;
                    modifiedEvent.damage = finalDamage;
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: finalDamage,
                        description: result.description || "伤害修改"
                    });
                }
                else {
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: beforeDamage,
                        description: (result === null || result === void 0 ? void 0 : result.description) || "未修改伤害"
                    });
                }
            }
            catch (error) {
                debugSteps.push({
                    modifierName: modifier.name,
                    beforeDamage: modifiedEvent.damage,
                    afterDamage: modifiedEvent.damage,
                    description: `错误: ${error}`
                });
                utils.printl(`伤害修改器 ${modifier.name} 错误: ${error}`);
            }
        }
        this.displayDebugInfo(debugSteps, event);
        return { damage: finalDamage };
    }
    displayDebugInfo(debugSteps, originalEvent) {
        if (!this.debugEnabled || debugSteps.length <= 1) {
            return;
        }
        const attacker = originalEvent.attacker;
        const victim = originalEvent.player;
        let debugOutput = `伤害修改链 (`;
        if (attacker && victim) {
            const attackerName = attacker.GetEntityName() || "未知攻击者";
            const victimName = victim.GetEntityName() || "未知受害者";
            debugOutput += `${attackerName} → ${victimName}`;
        }
        debugOutput += `):\n`;
        for (let i = 0; i < debugSteps.length; i++) {
            const step = debugSteps[i];
            const arrow = i === 0 ? "┌─" : i === debugSteps.length - 1 ? "└─" : "├─";
            if (step.beforeDamage !== step.afterDamage) {
                debugOutput += `${arrow} ${step.modifierName}: ${step.beforeDamage} → ${step.afterDamage}`;
                if (step.description && step.description !== "伤害修改") {
                    debugOutput += ` (${step.description})`;
                }
            }
            else {
                debugOutput += `${arrow} ${step.modifierName}: ${step.description}`;
            }
            debugOutput += "\n";
        }
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;
        const totalChange = finalDamage - initialDamage;
        const changePercentage = ((totalChange / initialDamage) * 100).toFixed(1);
        debugOutput += `总计: ${initialDamage} → ${finalDamage} (${totalChange > 0 ? '+' : ''}${totalChange}, ${changePercentage}%)`;
        utils.printl(debugOutput);
        this.displayScreenDebugInfo(debugSteps);
    }
    displayScreenDebugInfo(debugSteps) {
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;
        const modifiedSteps = debugSteps.filter(step => step.beforeDamage !== step.afterDamage && step.modifierName !== "初始伤害");
        if (modifiedSteps.length === 0) {
            return;
        }
        let screenText = `伤害: ${initialDamage} → ${finalDamage}\n`;
        for (const step of modifiedSteps) {
            const change = step.afterDamage - step.beforeDamage;
            screenText += `${step.modifierName}: ${change > 0 ? '+' : ''}${change}\n`;
        }
        Instance.DebugScreenText({
            text: screenText,
            x: 0.02,
            y: 0.02,
            duration: 3.0,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
    }
}
const damageModifierSystem = new DamageModifierSystem();

class CriticalStrikeAbility {
    constructor(playerId, getPlayer) {
        this.name = "暴击";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            critChance: 0.2,
            critMultiplier: 1.5,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`暴击能力已为玩家 ${this.playerId} 初始化`);
        damageModifierSystem.registerModifier(`critical_strike_${this.playerId}`, 10, (event) => this.applyCriticalStrike(event));
    }
    applyCriticalStrike(event) {
        const attacker = event.attacker;
        const victim = event.player;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.critChance) {
            return {
                description: "暴击未触发"
            };
        }
        const critDamage = Math.floor(event.damage * this.config.critMultiplier);
        utils.printl(`玩家 ${this.playerId} 触发暴击!`);
        this.createCriticalEffects(victim.GetAbsOrigin(), critDamage);
        return {
            damage: critDamage,
            description: `暴击! ×${this.config.critMultiplier}`
        };
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 暴击能力已清理`);
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
    createCriticalEffects(position, damage) {
        Instance.DebugSphere({
            center: position,
            radius: 30,
            duration: 1.0,
            color: { r: 255, g: 255, b: 0, a: 200 }
        });
        Instance.DebugScreenText({
            text: "暴击!",
            x: 0.5,
            y: 0.5,
            duration: 1.5,
            color: { r: 255, g: 255, b: 0, a: 255 }
        });
        Instance.DebugScreenText({
            text: damage.toString(),
            x: 0.5,
            y: 0.55,
            duration: 1.5,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
        this.createCriticalParticles(position);
    }
    createCriticalParticles(position) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 2 * Math.PI;
            const distance = 20 + Math.random() * 30;
            const particlePos = {
                x: position.x + Math.cos(angle) * distance,
                y: position.y + Math.sin(angle) * distance,
                z: position.z + Math.random() * 40
            };
            Instance.DebugSphere({
                center: particlePos,
                radius: 3,
                duration: 0.8,
                color: { r: 255, g: 255, b: 0, a: 200 }
            });
            Instance.DebugLine({
                start: position,
                end: particlePos,
                duration: 0.5,
                color: { r: 255, g: 200, b: 0, a: 150 }
            });
        }
    }
}

class PayToWinAbility {
    constructor(playerId, getPlayer) {
        this.name = "挥金如土";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            costPerShot: 10,
            damageMultiplier: 1.5,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`付费赢家能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            if (this.config.enabled) {
                this.onGunFire(event);
            }
        });
        damageModifierSystem.registerModifier(`pay_to_win_${this.playerId}`, 5, (event) => this.applyDamageBoost(event));
    }
    applyDamageBoost(event) {
        const attacker = event.attacker;
        event.player;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        return {
            damage: boostedDamage,
            description: `付费伤害 ×${this.config.damageMultiplier}`
        };
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 付费赢家能力已清理`);
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
    onGunFire(event) {
        const weapon = event.weapon;
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn())
            return;
        this.deductMoney();
        this.createCostEffect();
    }
    deductMoney() {
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.costPerShot.toString());
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.costPerShot.toString(), 0.00, undefined, this.getPlayer().getPawn());
        utils.printl(`玩家 ${this.playerId} 开枪扣钱: -$${this.config.costPerShot}`);
    }
    createCostEffect() {
        const player = this.getPlayer();
        if (!player)
            return;
        const pawn = player.getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 15,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `-$${this.config.costPerShot}`,
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
        this.createMoneyParticles(playerPos);
    }
    createDamageBoostEffect(position, damage) {
        Instance.DebugSphere({
            center: position,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 215, b: 0, a: 200 }
        });
        Instance.DebugScreenText({
            text: `$${damage}`,
            x: 0.5,
            y: 0.55,
            duration: 1.5,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }
    createMoneyParticles(position) {
        for (let i = 0; i < 5; i++) {
            const offset = {
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 20,
                z: Math.random() * 30
            };
            const particlePos = {
                x: position.x + offset.x,
                y: position.y + offset.y,
                z: position.z + offset.z
            };
            Instance.DebugSphere({
                center: particlePos,
                radius: 2,
                duration: 0.8,
                color: { r: 255, g: 215, b: 0, a: 200 }
            });
        }
    }
}

class ReloadDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "换弹增伤";
        this.version = "1.0.0";
        this.isBoostActive = false;
        this.boostEndTime = 0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `reload_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            damageMultiplier: 2,
            boostDuration: 3.0,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`换弹伤害加成能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunReload((event) => {
            this.onGunReload(event);
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyDamageBoost(event));
    }
    onGunReload(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.activateDamageBoost();
        utils.printl(`玩家 ${this.playerId} 换弹完成，获得 ${this.config.damageMultiplier}x 伤害加成`);
    }
    activateDamageBoost() {
        this.isBoostActive = true;
        this.boostEndTime = Instance.GetGameTime() + this.config.boostDuration;
        this.createBoostEffects();
    }
    applyDamageBoost(event) {
        if (!this.isBoostActive)
            return;
        const attacker = event.attacker;
        const currentTime = Instance.GetGameTime();
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (currentTime > this.boostEndTime) {
            this.isBoostActive = false;
            return;
        }
        const timeLeft = this.boostEndTime - currentTime;
        const timePercent = timeLeft / this.config.boostDuration;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        this.createDynamicEffects(timePercent);
        return {
            damage: boostedDamage,
            description: `换弹强化! ×${this.config.damageMultiplier} (${(timeLeft * 1000).toFixed(0)}ms)`
        };
    }
    update() {
        if (this.isBoostActive && Instance.GetGameTime() > this.boostEndTime) {
            this.isBoostActive = false;
            this.createExpireEffects();
            utils.printl(`玩家 ${this.playerId} 换弹伤害加成已结束`);
        }
        if (this.isBoostActive) {
            this.updateScreenHint();
        }
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        this.isBoostActive = false;
        utils.printl(`玩家 ${this.playerId} 换弹伤害加成能力已清理`);
    }
    onPlayerReset() {
        this.isBoostActive = false;
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
        if (!enabled) {
            this.isBoostActive = false;
        }
    }
    createBoostEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: position,
            radius: 50,
            duration: 0.5,
            color: { r: 0, g: 255, b: 255, a: 150 }
        });
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * 2 * Math.PI;
            const particlePos = {
                x: position.x + Math.cos(angle) * 40,
                y: position.y + Math.sin(angle) * 40,
                z: position.z
            };
            const endPos = {
                x: particlePos.x,
                y: particlePos.y,
                z: particlePos.z + 80
            };
            Instance.DebugLine({
                start: particlePos,
                end: endPos,
                duration: 0.3,
                color: { r: 0, g: 200, b: 255, a: 200 }
            });
        }
        Instance.DebugScreenText({
            text: "换弹完成! 伤害加成激活",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 0, g: 255, b: 255, a: 255 }
        });
    }
    createDynamicEffects(timePercent) {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        const intensity = Math.floor(255 * timePercent);
        const color = {
            r: 0,
            g: intensity,
            b: 255,
            a: 100 + Math.floor(155 * timePercent)
        };
        const radius = 30 + 20 * timePercent;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.1,
            color: color
        });
    }
    createExpireEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        pawn.GetAbsOrigin();
        Instance.DebugScreenText({
            text: "伤害加成结束",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 100, b: 0, a: 255 }
        });
    }
    updateScreenHint() {
        if (!this.isBoostActive)
            return;
        const timeLeft = this.boostEndTime - Instance.GetGameTime();
        const timeLeftMs = Math.max(0, timeLeft * 1000);
        Instance.DebugScreenText({
            text: `换弹伤害加成: ${this.config.damageMultiplier}x\n剩余: ${timeLeftMs.toFixed(0)}ms`,
            x: 0.02,
            y: 0.1,
            duration: 0.1,
            color: { r: 0, g: 200, b: 255, a: 255 }
        });
    }
    getStatus() {
        const timeLeft = this.isBoostActive ? Math.max(0, this.boostEndTime - Instance.GetGameTime()) : 0;
        return {
            isActive: this.isBoostActive,
            timeLeft: timeLeft
        };
    }
}

class VelocityDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "速度增伤";
        this.version = "1.0.0";
        this.currentSpeed = 0;
        this.currentMultiplier = 1.0;
        this.lastSpeedCheck = 0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `velocity_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            minSpeed: 100,
            maxSpeed: 250,
            minDamageMultiplier: 1.0,
            maxDamageMultiplier: 2.5,
            checkInterval: 0.1,
            considerZAxis: false
        };
    }
    initialize() {
        utils.printl(`速度增伤能力已为玩家 ${this.playerId} 初始化 (Z轴: ${this.config.considerZAxis ? '开启' : '关闭'})`);
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyVelocityDamageBoost(event));
    }
    update() {
        if (!this.config.enabled)
            return;
        const currentTime = Instance.GetGameTime();
        if (currentTime - this.lastSpeedCheck < this.config.checkInterval) {
            return;
        }
        this.lastSpeedCheck = currentTime;
        this.updatePlayerSpeed();
        this.updateDamageMultiplier();
        this.updateVisualEffects();
    }
    updatePlayerSpeed() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) {
            this.currentSpeed = 0;
            return;
        }
        const velocity = pawn.GetAbsVelocity();
        if (this.config.considerZAxis) {
            this.currentSpeed = utils.vectorDistance(velocity);
        }
        else {
            this.currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        }
    }
    updateDamageMultiplier() {
        if (this.currentSpeed < this.config.minSpeed) {
            this.currentMultiplier = 1.0;
            return;
        }
        if (this.currentSpeed >= this.config.maxSpeed) {
            this.currentMultiplier = this.config.maxDamageMultiplier;
            return;
        }
        const speedRange = this.config.maxSpeed - this.config.minSpeed;
        const speedProgress = (this.currentSpeed - this.config.minSpeed) / speedRange;
        const multiplierRange = this.config.maxDamageMultiplier - this.config.minDamageMultiplier;
        this.currentMultiplier = this.config.minDamageMultiplier + (speedProgress * multiplierRange);
    }
    applyVelocityDamageBoost(event) {
        if (!this.config.enabled)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (this.currentSpeed < this.config.minSpeed)
            return;
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);
        const speedType = this.config.considerZAxis ? "三维速度" : "水平速度";
        return {
            damage: boostedDamage,
            description: `速度增伤! ×${this.currentMultiplier.toFixed(2)} (${speedType}: ${Math.floor(this.currentSpeed)})`
        };
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 速度增伤能力已清理`);
    }
    onPlayerReset() {
        this.currentSpeed = 0;
        this.currentMultiplier = 1.0;
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
    setConsiderZAxis(enabled) {
        this.config.considerZAxis = enabled;
        utils.printl(`玩家 ${this.playerId} 速度增伤Z轴计算: ${enabled ? '开启' : '关闭'}`);
    }
    getStatus() {
        return {
            speed: this.currentSpeed,
            multiplier: this.currentMultiplier,
            isActive: this.currentSpeed >= this.config.minSpeed,
            considerZAxis: this.config.considerZAxis
        };
    }
    updateVisualEffects() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        if (this.currentSpeed >= this.config.minSpeed) {
            const intensity = Math.floor(255 * (this.currentMultiplier - 1) / (this.config.maxDamageMultiplier - 1));
            const color = {
                r: intensity,
                g: 255 - intensity,
                b: 0,
                a: 100 + intensity
            };
            Instance.DebugSphere({
                center: position,
                radius: 20 + (intensity / 255) * 30,
                duration: 0.1,
                color: color
            });
            const velocity = pawn.GetAbsVelocity();
            const normalizedVel = utils.normalizeVector(velocity);
            const endPos = {
                x: position.x + normalizedVel.x * 50,
                y: position.y + normalizedVel.y * 50,
                z: position.z + (this.config.considerZAxis ? normalizedVel.z * 50 : 0)
            };
            Instance.DebugLine({
                start: position,
                end: endPos,
                duration: 0.1,
                color: color
            });
        }
        this.updateScreenHint();
    }
    updateScreenHint() {
        const speedType = this.config.considerZAxis ? "3D速度" : "2D速度";
        const statusText = this.currentSpeed >= this.config.minSpeed ?
            `速度增伤: ${this.currentMultiplier.toFixed(2)}x\n${speedType}: ${Math.floor(this.currentSpeed)}` :
            `${speedType}: ${Math.floor(this.currentSpeed)}`;
        Instance.DebugScreenText({
            text: statusText,
            x: 0.02,
            y: 0.12,
            duration: 0.1,
            color: this.currentSpeed >= this.config.minSpeed ?
                { r: 0, g: 255, b: 0, a: 255 } :
                { r: 150, g: 150, b: 150, a: 255 }
        });
    }
}

class DrawDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "切枪增伤";
        this.version = "1.0.0";
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `draw_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            damageMultiplier: 1.5
        };
    }
    initialize() {
        utils.printl(`切枪增伤能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });
        Instance.OnPlayerActivate((event) => {
            this.resetState();
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyDrawDamageBoost(event));
    }
    onGunFire(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.getPlayer();
        const currentWeapon = weapon.GetClassName();
        if (this.lastWeaponBeforeFire === "") {
            this.lastWeaponBeforeFire = currentWeapon;
            return;
        }
        if (this.lastWeaponBeforeFire !== currentWeapon) {
            this.nextShotBoosted = true;
            this.createWeaponSwitchEffects();
            utils.printl(`玩家 ${this.playerId} 切枪，下一发子弹获得 ${this.config.damageMultiplier}x 伤害加成`);
        }
        this.lastWeaponBeforeFire = currentWeapon;
    }
    applyDrawDamageBoost(event) {
        var _a;
        if (!this.config.enabled || !this.nextShotBoosted)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        this.createSingleShotEffects((_a = event.player) === null || _a === void 0 ? void 0 : _a.GetAbsOrigin());
        this.nextShotBoosted = false;
        return {
            damage: boostedDamage,
            description: `切枪增伤! ×${this.config.damageMultiplier}`
        };
    }
    update() {
        this.updateScreenHint();
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
        utils.printl(`玩家 ${this.playerId} 切枪增伤能力已清理`);
    }
    onPlayerReset() {
        this.resetState();
    }
    onPlayerDisconnect() {
        this.cleanup();
    }
    resetState() {
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
    }
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    getConfig() {
        return Object.assign({}, this.config);
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.nextShotBoosted = false;
        }
    }
    createWeaponSwitchEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: position,
            radius: 60,
            duration: 1.0,
            color: { r: 255, g: 0, b: 255, a: 150 }
        });
        Instance.DebugScreenText({
            text: "切枪完成! 下一发子弹增伤",
            x: 0.5,
            y: 0.3,
            duration: 2.0,
            color: { r: 255, g: 0, b: 255, a: 255 }
        });
    }
    createSingleShotEffects(targetPosition) {
        if (!targetPosition)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const attackerPosition = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.5,
            color: { r: 255, g: 0, b: 255, a: 200 }
        });
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.8,
            color: { r: 255, g: 0, b: 255, a: 180 }
        });
    }
    updateScreenHint() {
        if (this.nextShotBoosted) {
            Instance.DebugScreenText({
                text: `切枪增伤: 下一发子弹 ${this.config.damageMultiplier}x`,
                x: 0.02,
                y: 0.16,
                duration: 0.1,
                color: { r: 255, g: 0, b: 255, a: 255 }
            });
        }
    }
    getStatus() {
        return {
            nextShotBoosted: this.nextShotBoosted,
            lastWeapon: this.lastWeaponBeforeFire,
            currentWeapon: this.getPlayer().getCurrentWeapon()
        };
    }
}

class BerserkDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "血量增伤";
        this.version = "1.0.0";
        this.currentMultiplier = 1.0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `berserk_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            minHealthThreshold: 20,
            maxDamageMultiplier: 5.0
        };
    }
    initialize() {
        utils.printl(`血量增伤已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyBerserkDamageBoost(event));
    }
    onGunFire(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.calculateDamageMultiplier();
        if (this.currentMultiplier > 1.0) {
            this.createBerserkFireEffects();
        }
    }
    calculateDamageMultiplier() {
        const playerInstance = this.getPlayer();
        if (!playerInstance || !playerInstance.isValid()) {
            this.currentMultiplier = 1.0;
            return;
        }
        const health = playerInstance.getHP();
        const maxHealth = playerInstance.getHPMAX();
        if (health <= 0 || maxHealth <= 0) {
            this.currentMultiplier = 1.0;
            return;
        }
        const healthPercent = (health / maxHealth) * 100;
        if (healthPercent > this.config.minHealthThreshold) {
            this.currentMultiplier = 1.0;
            return;
        }
        const progress = 1 - (healthPercent / this.config.minHealthThreshold);
        this.currentMultiplier = 1.0 + (this.config.maxDamageMultiplier - 1.0) * Math.pow(progress, 1.5);
    }
    applyBerserkDamageBoost(event) {
        var _a;
        if (!this.config.enabled || this.currentMultiplier <= 1.0)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);
        this.createBerserkAttackEffects((_a = event.player) === null || _a === void 0 ? void 0 : _a.GetAbsOrigin());
        const playerInstance = this.getPlayer();
        const health = playerInstance.getHP();
        const maxHealth = playerInstance.getHPMAX();
        const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
        return {
            damage: boostedDamage,
            description: `血量增伤! ×${this.currentMultiplier.toFixed(2)} (血量: ${Math.floor(healthPercent)}%)`
        };
    }
    update() {
        if (this.currentMultiplier > 1.0) {
            this.updateScreenHint();
        }
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 血量增伤能力已清理`);
    }
    onPlayerReset() {
        this.currentMultiplier = 1.0;
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
        if (!enabled) {
            this.currentMultiplier = 1.0;
        }
    }
    getStatus() {
        const playerInstance = this.getPlayer();
        const health = playerInstance ? playerInstance.getHP() : 0;
        const maxHealth = playerInstance ? playerInstance.getHPMAX() : 0;
        const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
        return {
            health: health,
            maxHealth: maxHealth,
            healthPercent: healthPercent,
            multiplier: this.currentMultiplier,
            isActive: this.currentMultiplier > 1.0
        };
    }
    createBerserkFireEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        const status = this.getStatus();
        const intensity = 1 - (status.healthPercent / this.config.minHealthThreshold);
        const radius = 25 + 25 * intensity;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.3,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugSphere({
            center: position,
            radius: radius + 15,
            duration: 0.5,
            color: { r: 255, g: 50, b: 50, a: 100 }
        });
        Instance.DebugScreenText({
            text: `血量增伤激活! 伤害: ${this.currentMultiplier.toFixed(2)}x`,
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
    }
    createBerserkAttackEffects(targetPosition) {
        if (!targetPosition)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const attackerPosition = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.3,
            color: { r: 255, g: 0, b: 0, a: 200 }
        });
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 180 }
        });
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * 2 * Math.PI;
            const startPos = {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z
            };
            const endPos = {
                x: targetPosition.x + Math.cos(angle) * 35,
                y: targetPosition.y + Math.sin(angle) * 35,
                z: targetPosition.z
            };
            Instance.DebugLine({
                start: startPos,
                end: endPos,
                duration: 0.3,
                color: { r: 200, g: 0, b: 0, a: 150 }
            });
        }
    }
    updateScreenHint() {
        const status = this.getStatus();
        const healthText = `血量: ${Math.floor(status.health)}/${status.maxHealth} (${Math.floor(status.healthPercent)}%)`;
        const damageText = `血量增伤: ${status.multiplier.toFixed(2)}x`;
        Instance.DebugScreenText({
            text: `${healthText}\n${damageText}`,
            x: 0.02,
            y: 0.18,
            duration: 0.1,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
        if (status.healthPercent <= 15) {
            Instance.DebugScreenText({
                text: "警告! 濒死状态",
                x: 0.5,
                y: 0.4,
                duration: 0.1,
                color: { r: 255, g: 0, b: 0, a: 255 }
            });
        }
    }
}

var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const cellModel = "models/7ychu5/public/box.vmdl";
class FlipGame {
    constructor(config) {
        this.grid = [];
        this.fixedCells = [];
        this.cells = [];
        this.gameActive = false;
        this.connections = [];
        this.isCompleted = false;
        this.config = {
            gridSize: 3,
            fixedCellProbability: 0.1,
            spacing: 32
        };
        this.difficultySettings = {
            easy: { gridSize: 3, fixedCellProbability: 0.1 },
            medium: { gridSize: 5, fixedCellProbability: 0.2 },
            hard: { gridSize: 7, fixedCellProbability: 0.3 }
        };
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
        this.connections = [];
        this.startPosition = C.WorldOrigin;
        this.instanceId = (config === null || config === void 0 ? void 0 : config.instanceId) || `flip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.cellTemplate = Instance.FindEntityByName("template_prop_solid_placeholder");
        if (config) {
            this.applyConfig(config);
        }
        this.initializeGame();
        if ((config === null || config === void 0 ? void 0 : config.autoStart) !== false) {
            this.startGame();
        }
    }
    applyConfig(config) {
        if (config.difficulty && this.difficultySettings[config.difficulty]) {
            const difficultyConfig = this.difficultySettings[config.difficulty];
            this.config.gridSize = difficultyConfig.gridSize;
            this.config.fixedCellProbability = difficultyConfig.fixedCellProbability;
        }
        if (config.gridSize !== undefined) {
            this.config.gridSize = config.gridSize;
        }
        if (config.startPosition !== undefined) {
            this.startPosition = config.startPosition;
        }
        else if (config.startEntityName) {
            this.setStartEntity(config.startEntityName);
        }
        if (config.fixedCellProbability !== undefined) {
            this.config.fixedCellProbability = config.fixedCellProbability;
        }
        if (config.spacing !== undefined) {
            this.config.spacing = config.spacing;
        }
    }
    initializeGame() {
        if (this.startPosition === C.WorldOrigin) {
            const startEntity = Instance.FindEntityByName("puzzle_flipGame_loc_1");
            if (startEntity) {
                this.startPosition = startEntity.GetAbsOrigin();
            }
        }
        if (!this.cellTemplate) {
            utils.printl(`[${this.instanceId}] 错误：未找到格子模板 template_prop_solid_placeholder`);
            return;
        }
        this.setupEventListeners();
    }
    setupEventListeners() {
        Instance.OnScriptInput(`flip_reset_${this.instanceId}`, () => {
            this.resetGame();
        });
        Instance.OnScriptInput(`flip_stop_${this.instanceId}`, () => {
            this.stopGame();
        });
    }
    createSolvablePuzzle() {
        for (let i = 0; i < this.config.gridSize; i++) {
            this.grid[i] = [];
            this.fixedCells[i] = [];
            for (let j = 0; j < this.config.gridSize; j++) {
                this.grid[i][j] = false;
                this.fixedCells[i][j] = Math.random() < this.config.fixedCellProbability;
            }
        }
        const operations = Math.floor(this.config.gridSize * this.config.gridSize * 0.4);
        for (let k = 0; k < operations; k++) {
            const i = Math.floor(Math.random() * this.config.gridSize);
            const j = Math.floor(Math.random() * this.config.gridSize);
            this.simulateFlip(i, j);
        }
    }
    simulateFlip(row, col) {
        const positions = [
            { r: row, c: col },
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ];
        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r][pos.c]) {
                    this.grid[pos.r][pos.c] = !this.grid[pos.r][pos.c];
                }
            }
        });
    }
    createGrid() {
        var _a;
        const baseAngle = { pitch: 0, yaw: 0, roll: 0 };
        this.destroyGrid();
        this.createSolvablePuzzle();
        for (let i = 0; i < this.config.gridSize; i++) {
            this.cells[i] = [];
            for (let j = 0; j < this.config.gridSize; j++) {
                const position = {
                    x: this.startPosition.x + i * this.config.spacing,
                    y: this.startPosition.y,
                    z: this.startPosition.z + j * this.config.spacing
                };
                const spawned = (_a = this.cellTemplate) === null || _a === void 0 ? void 0 : _a.ForceSpawn(position, baseAngle);
                if (spawned && spawned.length > 0) {
                    const cell = spawned[0];
                    const cellName = `flip_cell_${this.instanceId}_${i}_${j}`;
                    if (!cell || !(cell instanceof BaseModelEntity))
                        continue;
                    cell === null || cell === void 0 ? void 0 : cell.SetModel(cellModel);
                    cell === null || cell === void 0 ? void 0 : cell.SetEntityName(cellName);
                    this.cells[i][j] = cell;
                    const connId = Instance.ConnectOutput(cell, "OnHealthChanged", () => {
                        if (this.gameActive && !this.isCompleted) {
                            this.onCellClicked(i, j);
                        }
                    });
                    if (connId) {
                        this.connections.push(connId);
                    }
                    this.updateCellAppearance(i, j);
                }
            }
        }
    }
    onCellClicked(row, col) {
        if (!this.gameActive || this.isCompleted)
            return;
        utils.printl(`[${this.instanceId}] 格子被点击: ${row}, ${col}`);
        if (Instance.FindEntityByName("flip_game_sound_click")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_click",
                input: "PlaySound"
            });
        }
        this.flipCell(row, col);
        this.checkWinCondition();
    }
    flipCell(row, col) {
        const positions = [
            { r: row, c: col },
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ];
        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r][pos.c]) {
                    this.grid[pos.r][pos.c] = !this.grid[pos.r][pos.c];
                    this.updateCellAppearance(pos.r, pos.c);
                }
            }
        });
    }
    updateCellAppearance(row, col) {
        if (!this.cells[row] || !this.cells[row][col])
            return;
        const cell = this.cells[row][col];
        if (!(cell === null || cell === void 0 ? void 0 : cell.IsValid()))
            return;
        const isOn = this.grid[row][col];
        const isFixed = this.fixedCells[row][col];
        if (cell instanceof BaseModelEntity) {
            let color;
            if (isFixed) {
                color = { r: 150, g: 150, b: 150, a: 255 };
            }
            else {
                color = isOn ?
                    { r: 255, g: 100, b: 100, a: 255 } :
                    { r: 100, g: 100, b: 255, a: 255 };
            }
            cell.SetColor(color);
            if (!isFixed) {
                if (isOn) {
                    cell.Glow({ r: 255, g: 50, b: 50, a: 128 });
                }
                else {
                    cell.Unglow();
                }
            }
            else {
                cell.Unglow();
            }
            cell.SetModelScale(isFixed ? 0.9 : (isOn ? 1.0 : 0.8));
        }
    }
    checkWinCondition() {
        const firstState = this.grid[0][0];
        let allSame = true;
        for (let i = 0; i < this.config.gridSize && allSame; i++) {
            for (let j = 0; j < this.config.gridSize && allSame; j++) {
                if (!this.fixedCells[i][j] && this.grid[i][j] !== firstState) {
                    allSame = false;
                }
            }
        }
        if (allSame) {
            this.gameWin();
        }
    }
    gameWin() {
        return __awaiter$1(this, void 0, void 0, function* () {
            this.gameActive = false;
            this.isCompleted = true;
            utils.printl(`[${this.instanceId}] 游戏胜利！所有格子颜色统一！`);
            for (let i = 0; i < this.config.gridSize; i++) {
                for (let j = 0; j < this.config.gridSize; j++) {
                    if (!this.cells[i] || !this.cells[i][j])
                        continue;
                    const cell = this.cells[i][j];
                    if (cell instanceof BaseModelEntity) {
                        cell.SetColor({ r: 0, g: 255, b: 0, a: 255 });
                        if (!this.fixedCells[i][j]) {
                            cell.Unglow();
                        }
                    }
                }
            }
            this.triggerCompletionEvent();
            yield delay(3);
            this.stopGame();
        });
    }
    triggerCompletionEvent() {
        Instance.EntFireAtName({
            name: "flip_game_complete",
            input: "OnComplete",
            value: this.instanceId
        });
    }
    destroyGrid() {
        var _a;
        this.connections.forEach(connId => {
            Instance.DisconnectOutput(connId);
        });
        this.connections = [];
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i]) {
                for (let j = 0; j < ((_a = this.cells[i]) === null || _a === void 0 ? void 0 : _a.length); j++) {
                    const cell = this.cells[i][j];
                    if (cell === null || cell === void 0 ? void 0 : cell.IsValid()) {
                        cell.Remove();
                    }
                }
            }
        }
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
    }
    startGame() {
        if (this.gameActive) {
            this.stopGame();
        }
        this.gameActive = true;
        this.isCompleted = false;
        this.createGrid();
        utils.printl(`[${this.instanceId}] Flip Game 开始！网格大小: ${this.config.gridSize}x${this.config.gridSize}`);
        this.showGameInfo();
        if (Instance.FindEntityByName("flip_game_sound_start")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_start",
                input: "PlaySound"
            });
        }
    }
    showGameInfo() {
        Instance.DebugScreenText({
            text: `Flip Game ${this.config.gridSize}x${this.config.gridSize}\n射击格子翻转颜色\n目标是让所有非灰色格子变成相同颜色`,
            x: 0.5, y: 0.1, duration: 5,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
        let fixedCount = 0;
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                if (this.fixedCells[i][j])
                    fixedCount++;
            }
        }
        if (fixedCount > 0) {
            utils.printl(`[${this.instanceId}] 固定格子数量: ${fixedCount}`);
        }
    }
    resetGame() {
        if (!this.gameActive)
            return;
        utils.printl(`[${this.instanceId}] Flip Game 重置`);
        Instance.DebugScreenText({
            text: "游戏已重置",
            x: 0.5, y: 0.9, duration: 2,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
        this.createGrid();
    }
    stopGame() {
        this.gameActive = false;
        this.destroyGrid();
        utils.printl(`[${this.instanceId}] Flip Game 停止`);
    }
    setStartPosition(position) {
        this.startPosition = position;
        utils.printl(`[${this.instanceId}] 起始位置已设置: (${position.x}, ${position.y}, ${position.z})`);
    }
    setStartEntity(entityName) {
        const entity = Instance.FindEntityByName(entityName);
        if (entity) {
            this.startPosition = entity.GetAbsOrigin();
            utils.printl(`[${this.instanceId}] 起始位置已从实体 ${entityName} 设置`);
        }
        else {
            utils.printl(`[${this.instanceId}] 错误：未找到实体 ${entityName}`);
        }
    }
    getGameState() {
        return {
            active: this.gameActive,
            completed: this.isCompleted,
            gridSize: this.config.gridSize,
            instanceId: this.instanceId
        };
    }
    getInstanceId() {
        return this.instanceId;
    }
    isGameCompleted() {
        return this.isCompleted;
    }
    isGameActive() {
        return this.gameActive;
    }
    getConfig() {
        return {
            gridSize: this.config.gridSize,
            fixedCellProbability: this.config.fixedCellProbability,
            spacing: this.config.spacing,
            instanceId: this.instanceId
        };
    }
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let flipGame;
flipGame = new FlipGame();
flipGame.startGame();
class Player {
    constructor(id) {
        this.id = id;
        this.controller = undefined;
        this.pawn = undefined;
        this.sname = "";
        this.tname = "";
        this.model = "";
        this.team = 0;
        this.speed = 0;
        this.jump = false;
        this.crouch = false;
        this.hp = 100;
        this.hpmax = 100;
        this.alpha = 255;
        this.invisible = false;
        this.glowModel = undefined;
        this.particle01 = undefined;
        this.text = undefined;
        this.text_content = "";
        this.lastUsedWeapon = "";
        this.currentWeapon = "";
        this.abilityManager = new AbilityManager(id);
        this.initializeAbilities();
    }
    initializeAbilities() {
    }
    registerDamageAbility(ability) {
        this.abilityManager.registerAbility(ability);
    }
    updateAbilities() {
        this.abilityManager.updateAll();
    }
    getAbility(abilityName) {
        return this.abilityManager.getAbility(abilityName);
    }
    registerAbility(ability) {
        this.abilityManager.registerAbility(ability);
    }
    unregisterAbility(abilityName) {
        this.abilityManager.unregisterAbility(abilityName);
    }
    getAbilityNames() {
        return this.abilityManager.getAbilityNames();
    }
    onPlayerReset() {
        this.abilityManager.onPlayerReset();
        this.setTname("player#" + this.id.toString());
        this.setText();
        if (this.getParticle01() == undefined)
            this.updateParticle01(Instance.FindEntityByName(this.getTname() + "_particle01"));
        this.useParticle01("stop");
        switch (this.getTeam()) {
            case 2:
                this.updateModel("characters/models/tm_phoenix/tm_phoenix.vmdl");
                break;
            case 3:
                this.updateModel("characters/models/ctm_sas/ctm_sas.vmdl");
                break;
        }
    }
    onPlayerDisconnect() {
        this.abilityManager.onPlayerDisconnect();
    }
    onPlayerDeath() {
        this.useParticle01("start");
    }
    cCommand(command) {
        Instance.ClientCommand(this.id, command);
    }
    updateController() {
        this.controller = Instance.GetPlayerController(this.id);
    }
    getController() {
        this.updateController();
        return this.controller;
    }
    updatePawn() {
        var _a;
        this.pawn = (_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetPlayerPawn();
    }
    getPawn() {
        this.updatePawn();
        return this.pawn;
    }
    updateSname() {
        var _a;
        this.sname = ((_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetPlayerName()) || "";
    }
    getSname() {
        this.updateSname();
        return this.sname;
    }
    updateTname() {
        var _a;
        this.tname = ((_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetEntityName()) || "";
    }
    getTname() {
        this.updateTname();
        return this.tname;
    }
    setTname(params) {
        this.tname = params;
        const pawn = this.getPawn();
        if (pawn)
            pawn.SetEntityName(params);
    }
    updateTeam() {
        var _a;
        this.team = ((_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetTeamNumber()) || 0;
    }
    getTeam() {
        this.updateTeam();
        return this.team;
    }
    updateSpeed() {
        var _a;
        const velocity = (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetAbsVelocity();
        if (velocity) {
            this.speed = utils.vectorDistance(velocity);
        }
        else {
            this.speed = 0;
        }
    }
    getSpeed() {
        this.updateSpeed();
        return this.speed;
    }
    updateJump(status) {
        this.jump = status;
    }
    getJump() {
        return this.jump;
    }
    updateCrouch() {
        const pawn = this.getPawn();
        this.crouch = !!((pawn === null || pawn === void 0 ? void 0 : pawn.IsCrouched()) || (pawn === null || pawn === void 0 ? void 0 : pawn.IsCrouching()));
    }
    getCrouch() {
        this.updateCrouch();
        return this.crouch;
    }
    updateHP() {
        var _a;
        this.hp = (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetHealth();
    }
    setHP(health) {
        var _a;
        (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.SetHealth(health);
        this.updateHP();
    }
    getHP() {
        this.updateHP();
        return this.hp;
    }
    updateHPMAX() {
        var _a;
        this.hpmax = (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetMaxHealth();
    }
    setHPMAX(healthmax) {
        var _a;
        (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.SetMaxHealth(healthmax);
        this.updateHPMAX();
    }
    getHPMAX() {
        this.updateHPMAX();
        return this.hpmax;
    }
    updateAlpha(params) {
        this.alpha = params;
    }
    setAlpha() {
        const pawn = this.getPawn();
        if (pawn)
            utils.EntFireByHandle(pawn, "alpha", this.alpha.toString());
    }
    getAlpha() {
        return this.alpha;
    }
    updateModel(params) {
        this.model = params;
    }
    setModel() {
        const pawn = this.getPawn();
        if (pawn)
            pawn.SetModel(this.model);
    }
    getModel() {
        return this.model;
    }
    updateGlow(model) {
        this.glowModel = model;
    }
    setGlowModel() {
        return __awaiter(this, void 0, void 0, function* () {
            yield setPlayerGlow(this.id);
            yield delay(0.1);
            yield setPlayerGlow(this.id);
        });
    }
    getGlowModel() {
        return this.glowModel;
    }
    updateParticle01(entity) {
        this.particle01 = entity;
    }
    useParticle01(status) {
        switch (status) {
            case "start":
                utils.EntFireByHandle(this.getParticle01(), "start");
                break;
            case "stop":
                utils.EntFireByHandle(this.getParticle01(), "stop");
                break;
        }
    }
    getParticle01() {
        return this.particle01;
    }
    updateText() {
        let temptext1 = "当前技能：\n";
        let temptext2 = "";
        if (this.getAbilityNames() == undefined || this.getAbilityNames()[0] == "" || this.getAbilityNames().length == 0) {
            temptext2 = "Empty";
        }
        else {
            this.getAbilityNames().forEach(element => {
                temptext2 = temptext2 + element + "\n";
            });
        }
        this.text_content = temptext1 + temptext2;
        utils.EntFireByHandle(this.getText(), "SetMessage", this.text_content, 0.00);
    }
    setText() {
        var _a, _b, _c, _d;
        if (this.getText() !== undefined)
            return;
        let template = Instance.FindEntityByName("template_worldtext");
        let ent = template.ForceSpawn();
        ent ? this.text = ent[0] : this.text = undefined;
        (_a = this.getText()) === null || _a === void 0 ? void 0 : _a.SetEntityName("player_text#" + this.id);
        const eyePos = (_b = this.getPawn()) === null || _b === void 0 ? void 0 : _b.GetEyePosition();
        const eyeAngles = (_c = this.getPawn()) === null || _c === void 0 ? void 0 : _c.GetEyeAngles();
        const leftAngles45 = {
            pitch: eyeAngles.pitch,
            yaw: eyeAngles.yaw + 45,
            roll: eyeAngles.roll
        };
        const leftDirection = utils.angleToVector(leftAngles45);
        const faceForwardPos = {
            x: eyePos.x + leftDirection.x * 12,
            y: eyePos.y + leftDirection.y * 12,
            z: eyePos.z + leftDirection.z * 12 + 4
        };
        (_d = this.getText()) === null || _d === void 0 ? void 0 : _d.Teleport({ position: faceForwardPos });
        utils.EntFireByHandle(this.getText(), "SetParent", this.getTname(), 0.02);
    }
    getText() {
        if (Instance.FindEntityByName("player_text#" + this.id) !== undefined) {
            this.text = Instance.FindEntityByName("player_text#" + this.id);
        }
        return this.text;
    }
    updateCurrentWeapon() {
        var _a;
        const activeWeapon = (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetActiveWeapon();
        if (activeWeapon) {
            this.currentWeapon = activeWeapon.GetClassName();
        }
        else {
            this.currentWeapon = "";
        }
    }
    getCurrentWeapon() {
        this.updateCurrentWeapon();
        return this.currentWeapon;
    }
    updateLastUsedWeapon() {
        this.lastUsedWeapon = this.currentWeapon;
    }
    getLastUsedWeapon() {
        return this.lastUsedWeapon;
    }
    hasSwitchedWeapon() {
        return this.lastUsedWeapon !== "" &&
            this.currentWeapon !== "" &&
            this.lastUsedWeapon !== this.currentWeapon;
    }
    isValid() {
        var _a;
        return !!((_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.IsValid());
    }
    getPosition() {
        var _a;
        return (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetAbsOrigin();
    }
    getEyePosition() {
        var _a;
        return (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetEyePosition();
    }
}
const players = [];
function initializePlayerSystem() {
    for (let j = 0; j <= 64; j++) {
        if (!Instance.GetPlayerController(j))
            continue;
        if (!players[j]) {
            players[j] = new Player(j);
        }
        const playerInstance = players[j];
        playerInstance === null || playerInstance === void 0 ? void 0 : playerInstance.onPlayerReset();
    }
}
Instance.OnPlayerReset(({ player }) => {
    var _a;
    let j = (_a = player.GetPlayerController()) === null || _a === void 0 ? void 0 : _a.GetPlayerSlot();
    if (!Instance.GetPlayerController(j))
        return;
    if (!players[j]) {
        players[j] = new Player(j);
    }
    const playerInstance = players[j];
    playerInstance === null || playerInstance === void 0 ? void 0 : playerInstance.onPlayerReset();
});
Instance.OnPlayerDisconnect((event) => {
    const playerSlot = event.playerSlot;
    if (players[playerSlot]) {
        players[playerSlot].onPlayerDisconnect();
    }
});
Instance.OnScriptInput("_setPlayerGlow", () => { setPlayerGlow(0); });
function setPlayerGlow(playerId, status) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        utils.printl("setPlayerGlow step0" + playerId);
        let glowModel = (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getGlowModel();
        if (glowModel != undefined)
            utils.EntFireByHandle(glowModel, "kill");
        utils.printl("setPlayerGlow step1" + playerId);
        let template = Instance.FindEntityByName("template_prop_nosolid_placeholder");
        let spawned = template.ForceSpawn();
        if (spawned !== undefined && spawned[0] !== undefined) {
            spawned[0].SetModel((_b = players[playerId]) === null || _b === void 0 ? void 0 : _b.getModel());
            spawned[0].Glow();
            utils.EntFireByHandle(spawned[0], "FollowEntity", (_c = players[playerId]) === null || _c === void 0 ? void 0 : _c.getTname());
            utils.EntFireByHandle(spawned[0], "alpha", "1");
            (_d = players[playerId]) === null || _d === void 0 ? void 0 : _d.updateGlow(spawned[0]);
        }
        yield delay(0.05);
        setPlayerGlow(playerId);
    });
}
Instance.OnScriptInput("givePlayerAbility_grapple", (ctx) => { givePlayerAbility(ctx, "grapple"); });
Instance.OnScriptInput("givePlayerAbility_doubleJump", (ctx) => { givePlayerAbility(ctx, "doubleJump"); });
Instance.OnScriptInput("givePlayerAbility_climbing", (ctx) => { givePlayerAbility(ctx, "climbing"); });
Instance.OnScriptInput("givePlayerAbility_dash", (ctx) => { givePlayerAbility(ctx, "dash"); });
Instance.OnScriptInput("givePlayerAbility_lifeSteal", (ctx) => { givePlayerAbility(ctx, "lifeSteal"); });
Instance.OnScriptInput("givePlayerAbility_bulletExplode", (ctx) => { givePlayerAbility(ctx, "bulletExplode"); });
Instance.OnScriptInput("givePlayerAbility_bulletRicochet", (ctx) => { givePlayerAbility(ctx, "bulletRicochet"); });
Instance.OnScriptInput("givePlayerAbility_stealPing", (ctx) => { givePlayerAbility(ctx, "stealPing"); });
Instance.OnScriptInput("givePlayerAbility_critical", (ctx) => { givePlayerAbility(ctx, "critical"); });
Instance.OnScriptInput("givePlayerAbility_payToWin", (ctx) => { givePlayerAbility(ctx, "paytowin"); });
Instance.OnScriptInput("givePlayerAbility_reloadDamageBoost", (ctx) => { givePlayerAbility(ctx, "reloadDamageBoost"); });
Instance.OnScriptInput("givePlayerAbility_velocityDamageBoost", (ctx) => { givePlayerAbility(ctx, "velocityDamageBoost"); });
Instance.OnScriptInput("givePlayerAbility_drawDamageBoost", (ctx) => { givePlayerAbility(ctx, "drawDamageBoost"); });
Instance.OnScriptInput("givePlayerAbility_berserkDamageBoost", (ctx) => { givePlayerAbility(ctx, "berserkDamageBoost"); });
function givePlayerAbility(ctx, params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    let playerId = ctx.activator.GetPlayerController().GetPlayerSlot();
    switch (params) {
        case "grapple":
            const grappleAbility = new GrappleAbility(playerId, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getPawn(); }, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getCrouch(); });
            (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.registerAbility(grappleAbility);
            break;
        case "doubleJump":
            const doubleJumpAbility = new DoubleJumpAbility(playerId, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getPawn(); }, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getCrouch(); });
            (_b = players[playerId]) === null || _b === void 0 ? void 0 : _b.registerAbility(doubleJumpAbility);
            break;
        case "climbing":
            const climbingAbility = new ClimbingAbility(playerId, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getPawn(); });
            (_c = players[playerId]) === null || _c === void 0 ? void 0 : _c.registerAbility(climbingAbility);
            break;
        case "dash":
            const dashAbility = new DashAbility(playerId, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getPawn(); }, () => { var _a; return (_a = players[playerId]) === null || _a === void 0 ? void 0 : _a.getCrouch(); });
            (_d = players[playerId]) === null || _d === void 0 ? void 0 : _d.registerAbility(dashAbility);
            break;
        case "lifeSteal":
            const lifeStealBulletAbility = new LifeStealBulletAbility(playerId, () => players[playerId]);
            (_e = players[playerId]) === null || _e === void 0 ? void 0 : _e.registerAbility(lifeStealBulletAbility);
            break;
        case "bulletExplode":
            const explosiveBulletAbility = new ExplosiveBulletAbility(playerId, () => players[playerId]);
            (_f = players[playerId]) === null || _f === void 0 ? void 0 : _f.registerAbility(explosiveBulletAbility);
            break;
        case "bulletRicochet":
            const ricochetBulletAbility = new RicochetBulletAbility(playerId, () => players[playerId]);
            (_g = players[playerId]) === null || _g === void 0 ? void 0 : _g.registerAbility(ricochetBulletAbility);
            break;
        case "stealPing":
            const stealMarkAbility = new StealMarkAbility(playerId, () => players[playerId]);
            (_h = players[playerId]) === null || _h === void 0 ? void 0 : _h.registerAbility(stealMarkAbility);
            break;
        case "critical":
            const criticalStrikeAbility = new CriticalStrikeAbility(playerId, () => players[playerId]);
            (_j = players[playerId]) === null || _j === void 0 ? void 0 : _j.registerDamageAbility(criticalStrikeAbility);
            break;
        case "paytowin":
            const payToWinAbility = new PayToWinAbility(playerId, () => players[playerId]);
            (_k = players[playerId]) === null || _k === void 0 ? void 0 : _k.registerDamageAbility(payToWinAbility);
            break;
        case "reloadDamageBoost":
            const reloadDamageBoostAbility = new ReloadDamageBoostAbility(playerId, () => players[playerId]);
            (_l = players[playerId]) === null || _l === void 0 ? void 0 : _l.registerDamageAbility(reloadDamageBoostAbility);
            break;
        case "velocityDamageBoost":
            const velocityDamageBoostAbility = new VelocityDamageBoostAbility(playerId, () => players[playerId]);
            (_m = players[playerId]) === null || _m === void 0 ? void 0 : _m.registerDamageAbility(velocityDamageBoostAbility);
            break;
        case "drawDamageBoost":
            const drawDamageBoostAbility = new DrawDamageBoostAbility(playerId, () => players[playerId]);
            (_o = players[playerId]) === null || _o === void 0 ? void 0 : _o.registerDamageAbility(drawDamageBoostAbility);
            break;
        case "berserkDamageBoost":
            const berserkDamageBoostAbility = new BerserkDamageBoostAbility(playerId, () => players[playerId]);
            (_p = players[playerId]) === null || _p === void 0 ? void 0 : _p.registerDamageAbility(berserkDamageBoostAbility);
            break;
        default:
            utils.printl("Unexcepted Ability");
            break;
    }
}
Instance.SetThink(() => {
    var _a;
    tickCallback();
    for (const player of players) {
        if (player && player.isValid()) {
            player.updateAbilities();
            if (player.getPawn() && ((_a = player.getPawn()) === null || _a === void 0 ? void 0 : _a.IsValid()) && player.getText() !== undefined)
                player.updateText();
        }
    }
    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 128);
});
Instance.SetNextThink(Instance.GetGameTime());
Instance.OnScriptReload({
    after: () => {
        utils.printl("manager重载");
        initializePlayerSystem();
    },
});
Instance.OnRoundStart(() => {
    players.length = 0;
    initializePlayerSystem();
});
Instance.OnPlayerKill((event) => {
    var _a, _b;
    let playerId = (_a = event.player.GetPlayerController()) === null || _a === void 0 ? void 0 : _a.GetPlayerSlot();
    if (!playerId)
        return;
    (_b = players[playerId]) === null || _b === void 0 ? void 0 : _b.onPlayerDeath();
});

export { Player, initializePlayerSystem, players };
