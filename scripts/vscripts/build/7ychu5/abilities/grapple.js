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

export { GrappleAbility };
