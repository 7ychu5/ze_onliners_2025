// climbingAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 爬墙配置
export interface ClimbingConfig extends AbilityConfig {
    climbPower: number;
    forwardPower: number;
    traceDistance: number;
    checkInterval: number;
}

export class ClimbingAbility implements IAbility {
    public name: string = "攀附";
    public version: string = "1.0.0";

    private lastClimbTime: number = 0;
    private playerId: number;
    private getPlayerPawn: () => any;

    private config: ClimbingConfig;

    constructor(playerId: number, getPlayerPawn: () => any) {
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

    initialize(): void {
        utils.printl(`爬墙能力已为玩家 ${this.playerId} 初始化`);
    }

    update(): void {
        if (!this.config.enabled) return;

        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const currentTime = Instance.GetGameTime();

        // 检查冷却
        if (currentTime - this.lastClimbTime < (this.config.cooldown || 0)) return;

        // 检查爬墙条件
        if (this.canClimb()) {
            this.executeClimb();
        }
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 爬墙能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<ClimbingConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): ClimbingConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private canClimb(): boolean {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return false;

        // 检查是否在空中
        if (pawn.GetGroundEntity() !== undefined) return false;

        const playerPos = pawn.GetAbsOrigin();
        const eyeAngles = pawn.GetEyeAngles();

        // 计算检测点
        const headPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z + 72 }; // 头部位置
        const chestPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z + 48 }; // 胸部位置

        // 获取视线方向
        const eyeVector = utils.angleToVector(eyeAngles);
        const direction = utils.normalizeVector(eyeVector);

        // 计算检测终点
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

        // 执行射线检测
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

        // 头部无碰撞，胸部有碰撞
        return !headTrace.didHit && chestTrace.didHit;
    }

    private executeClimb(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const eyeAngles = pawn.GetEyeAngles();
        const direction = utils.angleToVector(eyeAngles);
        const normalizedDir = utils.normalizeVector(direction);

        // 应用爬墙速度：向上 + 向前
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