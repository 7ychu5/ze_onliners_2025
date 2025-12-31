// doubleJumpAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 双跳配置
export interface DoubleJumpConfig extends AbilityConfig {
    jumpPower: number;
    jumpCooldown: number;
    enableEffect: boolean;
}

// 双跳状态
const DoubleJumpState = {
    READY: 0,
    COOLDOWN: 1,
    USED: 2
};

export class DoubleJumpAbility implements IAbility {
    public name: string = "二段跳";
    public version: string = "1.0.0";

    private state: number = DoubleJumpState.READY;
    private lastJumpTime: number = 0;
    private wasCrouching: boolean = false;
    private playerId: number;
    private getPlayerPawn: () => any;
    private getPlayerCrouch: () => boolean;
    private wasInAir: boolean = false;

    private config: DoubleJumpConfig;

    constructor(playerId: number, getPlayerPawn: () => any, getPlayerCrouch: () => boolean) {
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

    initialize(): void {
        utils.printl(`双跳能力已为玩家 ${this.playerId} 初始化`);
    }

    update(): void {
        if (!this.config.enabled) return;

        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const currentTime = Instance.GetGameTime();
        const isInAir = pawn.GetGroundEntity() === undefined;
        const isCrouching = this.getPlayerCrouch();

        // 检测空中状态变化
        if (!this.wasInAir && isInAir) {
            // 刚离开地面，重置双跳状态
            this.state = DoubleJumpState.READY;
        }

        // 检查双跳触发条件
        if (this.state === DoubleJumpState.READY &&
            isInAir &&
            isCrouching &&
            !this.wasCrouching) {
            this.executeDoubleJump();
        }

        // 检查冷却结束
        if (this.state === DoubleJumpState.COOLDOWN &&
            currentTime - this.lastJumpTime >= this.config.jumpCooldown) {
            this.state = DoubleJumpState.READY;
        }

        // 更新状态记录
        this.wasCrouching = isCrouching;
        this.wasInAir = isInAir;

        // 更新UI显示
        this.updateDoubleJumpUI();
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 双跳能力已清理`);
    }

    onPlayerReset(): void {
        this.state = DoubleJumpState.READY;
        this.lastJumpTime = 0;
        this.wasCrouching = false;
        this.wasInAir = false;
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<DoubleJumpConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): DoubleJumpConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 状态控制
    getState(): number {
        return this.state;
    }

    isReady(): boolean {
        return this.state === DoubleJumpState.READY;
    }

    // 私有方法实现
    private executeDoubleJump(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const currentTime = Instance.GetGameTime();

        // 获取当前速度
        const currentVelocity = pawn.GetAbsVelocity();

        // 应用向上的速度，保持水平动量
        const newVelocity = {
            x: currentVelocity.x,
            y: currentVelocity.y,
            z: this.config.jumpPower
        };

        // 应用新速度
        pawn.Teleport({ velocity: newVelocity });

        // 更新状态
        this.state = DoubleJumpState.COOLDOWN;
        this.lastJumpTime = currentTime;

        // 播放效果
        if (this.config.enableEffect) {
            this.createDoubleJumpEffects();
        }

        utils.printl(`玩家 ${this.playerId} 使用双跳`);
    }

    private createDoubleJumpEffects(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

        const playerPos = pawn.GetAbsOrigin();

        // 创建跳跃特效
        Instance.DebugSphere({
            center: playerPos,
            radius: 32,
            duration: 0.5,
            color: { r: 0, g: 200, b: 255, a: 150 }
        });

        // 创建粒子效果（如果有粒子系统）
        this.createJumpParticles(playerPos);
    }

    private createJumpParticles(position: any): void {
        // 这里可以添加粒子效果
        // 例如：Instance.CreateParticle("particles/example.pcf", position);

        // 临时用调试线代替粒子效果
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

    private updateDoubleJumpUI(): void {
        const pawn = this.getPlayerPawn();
        if (!pawn || !pawn.IsValid()) return;

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

        // 显示状态（只在空中显示）
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

    // 工具方法
    forceReset(): void {
        this.state = DoubleJumpState.READY;
        this.lastJumpTime = 0;
    }

    // 调试信息
    getDebugInfo(): string {
        const stateNames = ["就绪", "冷却中", "已使用"];
        return `双跳状态: ${stateNames[this.state]}, 冷却剩余: ${Math.max(0, this.config.jumpCooldown - (Instance.GetGameTime() - this.lastJumpTime)).toFixed(1)}s`;
    }
}