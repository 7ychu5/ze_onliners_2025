// dashAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 冲刺配置
export interface DashConfig extends AbilityConfig {
    dashPower: number;
    checkInterval: number;
}

export class DashAbility implements IAbility {
    public name: string = "冲刺";
    public version: string = "1.0.0";

    private lastDashTime: number = 0;
    private wasCrouching: boolean = false;
    private playerId: number;
    private getPlayerPawn: () => any;
    private getPlayerCrouch: () => boolean;

    private config: DashConfig;

    constructor(playerId: number, getPlayerPawn: () => any, getPlayerCrouch: () => boolean) {
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

    initialize(): void {
        utils.printl(`冲刺能力已为玩家 ${this.playerId} 初始化`);
    }

    update(): void {
        if (!this.config.enabled) return;

        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const currentTime = Instance.GetGameTime();

        // 检查冷却
        if (currentTime - this.lastDashTime < (this.config.cooldown || 0)) return;

        // 检查冲刺条件
        if (this.canDash()) {
            this.executeDash();
        }

        // 更新蹲下状态记录
        this.wasCrouching = this.getPlayerCrouch();
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 冲刺能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<DashConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): DashConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private canDash(): boolean {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return false;

        // 检查是否在空中
        if (pawn.GetGroundEntity() !== undefined) return false;

        const isCrouching = this.getPlayerCrouch();

        // 只有在空中且刚刚开始蹲下时才触发
        return isCrouching && !this.wasCrouching;
    }

    private executeDash(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        // 获取当前速度
        const currentVelocity = pawn.GetAbsVelocity();

        // 计算当前速度方向（水平方向）
        const horizontalVelocity = {
            x: currentVelocity.x,
            y: currentVelocity.y,
            z: 0
        };

        // 计算速度大小
        const speed = Math.sqrt(
            horizontalVelocity.x * horizontalVelocity.x +
            horizontalVelocity.y * horizontalVelocity.y
        );

        // 如果当前速度很小，使用玩家视线方向
        let dashDirection;
        if (speed < 10) {
            const eyeAngles = pawn.GetEyeAngles();
            dashDirection = utils.angleToVector(eyeAngles);
            dashDirection.z = 0; // 只考虑水平方向
            dashDirection = utils.normalizeVector(dashDirection);
        } else {
            // 使用当前速度方向
            dashDirection = utils.normalizeVector(horizontalVelocity);
        }

        // 计算冲刺速度
        const dashVelocity = {
            x: dashDirection.x * this.config.dashPower,
            y: dashDirection.y * this.config.dashPower,
            z: currentVelocity.z // 保持原有垂直速度
        };

        // 应用冲刺速度
        pawn.Teleport({ velocity: dashVelocity });
        this.lastDashTime = Instance.GetGameTime();

        // 创建冲刺特效
        this.createDashEffects();

        utils.printl(`玩家 ${this.playerId} 使用冲刺`);
    }

    private createDashEffects(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const playerPos = pawn.GetAbsOrigin();

        // 创建冲刺特效
        Instance.DebugSphere({
            center: playerPos,
            radius: 30,
            duration: 0.5,
            color: { r: 255, g: 100, b: 0, a: 200 }
        });

        // 创建方向指示线
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