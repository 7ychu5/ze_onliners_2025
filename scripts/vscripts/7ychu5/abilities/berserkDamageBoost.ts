// berserkDamageBoost.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { damageModifierSystem } from "../abilities/damageModifierSystem";
import { utils } from "../utils";

// 血量增伤增伤配置
export interface BerserkDamageBoostConfig extends AbilityConfig {
    minHealthThreshold: number;     // 最低血量阈值
    maxDamageMultiplier: number;    // 最大伤害倍率
}

export class BerserkDamageBoostAbility implements IAbility {
    public name: string = "血量增伤";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any;

    private config: BerserkDamageBoostConfig;
    private currentMultiplier: number = 1.0;
    private modifierId: string;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `berserk_damage_boost_${this.playerId}`;

        this.config = {
            enabled: true,
            minHealthThreshold: 20,  // 20%血量进入狂暴模式
            maxDamageMultiplier: 5.0  // 5倍最大伤害
        };
    }

    initialize(): void {
        utils.printl(`血量增伤已为玩家 ${this.playerId} 初始化`);

        // 监听开枪事件
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });

        // 注册伤害修改器
        damageModifierSystem.registerModifier(
            this.modifierId,
            5, // 中等优先级
            (event) => this.applyBerserkDamageBoost(event)
        );
    }

    private onGunFire(event: any): void {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();

        // 检查武器拥有者是否是本玩家
        if (!owner || owner !== this.getPlayer().getPawn()) return;

        if (!this.config.enabled) return;

        // 计算当前伤害倍率
        this.calculateDamageMultiplier();

        // 如果处于低血量状态，显示特效
        if (this.currentMultiplier > 1.0) {
            this.createBerserkFireEffects();
        }
    }

    private calculateDamageMultiplier(): void {
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

        // 如果血量高于阈值，没有加成
        if (healthPercent > this.config.minHealthThreshold) {
            this.currentMultiplier = 1.0;
            return;
        }

        // 计算伤害倍率：血量越低，倍率越高
        const progress = 1 - (healthPercent / this.config.minHealthThreshold);
        this.currentMultiplier = 1.0 + (this.config.maxDamageMultiplier - 1.0) * Math.pow(progress, 1.5);
    }

    private applyBerserkDamageBoost(event: any): any {
        if (!this.config.enabled || this.currentMultiplier <= 1.0) return;

        const attacker = event.attacker;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 计算加成后的伤害
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);

        // 创建血量增伤攻击特效
        this.createBerserkAttackEffects(event.player?.GetAbsOrigin());

        const playerInstance = this.getPlayer();
        const health = playerInstance.getHP();
        const maxHealth = playerInstance.getHPMAX();
        const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;

        return {
            damage: boostedDamage,
            description: `血量增伤! ×${this.currentMultiplier.toFixed(2)} (血量: ${Math.floor(healthPercent)}%)`
        };
    }

    update(): void {
        // 这个版本不需要每帧更新，性能开销极低
        // 只更新屏幕提示（如果处于低血量状态）
        if (this.currentMultiplier > 1.0) {
            this.updateScreenHint();
        }
    }

    cleanup(): void {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 血量增伤能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
        this.currentMultiplier = 1.0;
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<BerserkDamageBoostConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): BerserkDamageBoostConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        if (!enabled) {
            this.currentMultiplier = 1.0;
        }
    }

    // 获取当前状态
    getStatus(): {
        health: number;
        maxHealth: number;
        healthPercent: number;
        multiplier: number;
        isActive: boolean
    } {
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

    // 视觉效果 - 只在关键事件触发
    private createBerserkFireEffects(): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();
        const status = this.getStatus();
        const intensity = 1 - (status.healthPercent / this.config.minHealthThreshold);

        // 创建血量增伤光环（只在开枪时显示）
        const radius = 25 + 25 * intensity;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.3, // 显示0.3秒
            color: { r: 255, g: 0, b: 0, a: 150 }
        });

        // 创建血色脉冲效果
        Instance.DebugSphere({
            center: position,
            radius: radius + 15,
            duration: 0.5,
            color: { r: 255, g: 50, b: 50, a: 100 }
        });

        // 屏幕提示
        Instance.DebugScreenText({
            text: `血量增伤激活! 伤害: ${this.currentMultiplier.toFixed(2)}x`,
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
    }

    private createBerserkAttackEffects(targetPosition: any): void {
        if (!targetPosition) return;

        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const attackerPosition = pawn.GetAbsOrigin();

        // 创建从攻击者到目标的血色连线
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.3,
            color: { r: 255, g: 0, b: 0, a: 200 }
        });

        // 在目标位置创建血量增伤攻击特效
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 180 }
        });

        // 创建血色冲击波
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

    private updateScreenHint(): void {
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

        // 在极低血量时添加警告提示
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