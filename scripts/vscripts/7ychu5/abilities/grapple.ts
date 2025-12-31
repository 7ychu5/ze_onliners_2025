// grappleAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 钩爪配置
export interface GrappleConfig extends AbilityConfig {
    speed: number;
    maxDistance: number;
    maxAngle: number;
    minDistance: number;
    playerSpeedMultiplier: number;
    grappleSpeedMultiplier: number;
    autoGrappleCheckInterval: number;
}

// 钩爪状态
const GrappleState = {
    INACTIVE: 0,
    FIRING: 1,
    ATTACHED: 2
};

export class GrappleAbility implements IAbility {
    public name: string = "钩爪";
    public version: string = "1.0.0";

    private state: number = GrappleState.INACTIVE;
    private grappleStartTime: number = 0;
    private grapplePoint: any = null;
    private lastGrappleTime: number = 0;
    private lastAutoCheckTime: number = 0;
    private playerId: number;
    private getPlayerPawn: () => any;
    private getPlayerCrouch: () => boolean;

    private config: GrappleConfig;

    constructor(playerId: number, getPlayerPawn: () => any, getPlayerCrouch: () => boolean) {
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

    initialize(): void {
        utils.printl(`钩爪能力已为玩家 ${this.playerId} 初始化`);
    }

    update(): void {
        if (!this.config.enabled) return;

        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const currentTime = Instance.GetGameTime();

        // 检查自动钩爪触发条件
        if (this.state === GrappleState.INACTIVE) {
            this.checkAutoGrapple(currentTime);
        }

        // 更新钩爪状态
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

    cleanup(): void {
        this.detachGrapple();
        utils.printl(`玩家 ${this.playerId} 钩爪能力已清理`);
    }

    onPlayerReset(): void {
        this.detachGrapple();
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<GrappleConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): GrappleConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        if (!enabled) {
            this.detachGrapple();
        }
    }

    // 状态控制
    forceDetach(): void {
        this.detachGrapple();
    }

    getState(): number {
        return this.state;
    }

    isActive(): boolean {
        return this.state === GrappleState.ATTACHED;
    }

    // 私有方法实现
    private checkAutoGrapple(currentTime: number): void {
        if (currentTime - this.lastGrappleTime < (this.config.cooldown || 0)) return;
        if (currentTime - this.lastAutoCheckTime < this.config.autoGrappleCheckInterval) return;

        this.lastAutoCheckTime = currentTime;
        if (this.isPlayerInAirAndCrouching()) {
            this.fireGrapple();
        }
    }

    private isPlayerInAirAndCrouching(): boolean {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return false;

        const isInAir = pawn.GetGroundEntity() === undefined;
        const isCrouching = this.getPlayerCrouch();
        return isInAir && isCrouching ;
    }

    private fireGrapple(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

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
        } else {
            this.state = GrappleState.FIRING;
            this.grappleStartTime = Instance.GetGameTime();
        }

        this.lastGrappleTime = Instance.GetGameTime();
    }

    private updateGrappleMovement(): void {
        if (!this.grapplePoint) return;
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

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

    private checkGrappleConditions(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid() || !this.grapplePoint) return;

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

    private detachGrapple(): void {
        if (this.state !== GrappleState.INACTIVE) {
            this.onGrappleDetach();
        }
        this.state = GrappleState.INACTIVE;
        this.grapplePoint = null;
    }

    // 效果和UI方法
    private createGrappleEffects(startPos: any, endPos: any): void {
        Instance.DebugLine({
            start: startPos,
            end: endPos,
            duration: 0.1,
            color: { r: 255, g: 200, b: 50, a: 255 }
        });
    }

    private updateGrappleEffects(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid() || !this.grapplePoint) return;

        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: playerPos,
            end: this.grapplePoint,
            duration: 0.1,
            color: { r: 255, g: 200, b: 50, a: 255 }
        });
    }

    private updateGrappleUI(distance: number): void {
        // UI更新逻辑 - 简化实现
    }

    private onGrappleDetach(): void {
        // 断开特效 - 简化实现
    }
}