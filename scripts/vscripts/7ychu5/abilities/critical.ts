// criticalStrikeAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";
import { damageModifierSystem } from "./damageModifierSystem";

// 暴击配置
export interface CriticalStrikeConfig extends AbilityConfig {
    critChance: number; // 暴击概率 (0-1)
    critMultiplier: number; // 暴击倍数
}

export class CriticalStrikeAbility implements IAbility {
    public name: string = "暴击";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any; // 获取玩家实例的回调

    private config: CriticalStrikeConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            critChance: 0.2, // 20%暴击概率
            critMultiplier: 1.5, // 2倍伤害
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`暴击能力已为玩家 ${this.playerId} 初始化`);

        // 注册伤害事件监听

        damageModifierSystem.registerModifier(
            `critical_strike_${this.playerId}`,
            10, // 较高优先级
            (event) => this.applyCriticalStrike(event)
        );
    }

    private applyCriticalStrike(event: any): any {
        const attacker = event.attacker;
        const victim = event.player;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 检查受害者是否是敌人
        //if (!victim || victim.GetTeamNumber() === attacker.GetTeamNumber()) return;

        // 检查暴击触发概率
        if (Math.random() > this.config.critChance) {
            return {
                description: "暴击未触发"
            };
        }

        // 计算暴击伤害
        const critDamage = Math.floor(event.damage * this.config.critMultiplier);

        utils.printl(`玩家 ${this.playerId} 触发暴击!`);

        // 创建暴击效果
        this.createCriticalEffects(victim.GetAbsOrigin(), critDamage);

        // 返回修改后的伤害和描述
        return {
            damage: critDamage,
            description: `暴击! ×${this.config.critMultiplier}`
        };
    }

    update(): void {
        // 不需要每帧更新
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 暴击能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<CriticalStrikeConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): CriticalStrikeConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    private createCriticalEffects(position: any, damage: number): void {
        // 创建暴击闪光效果
        Instance.DebugSphere({
            center: position,
            radius: 30,
            duration: 1.0,
            color: { r: 255, g: 255, b: 0, a: 200 } // 黄色闪光
        });

        // 创建暴击文字效果
        Instance.DebugScreenText({
            text: "暴击!",
            x: 0.5,
            y: 0.5,
            duration: 1.5,
            color: { r: 255, g: 255, b: 0, a: 255 }
        });

        // 显示暴击伤害数值
        Instance.DebugScreenText({
            text: damage.toString(),
            x: 0.5,
            y: 0.55,
            duration: 1.5,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });

        // 创建暴击粒子效果
        this.createCriticalParticles(position);
    }

    private createCriticalParticles(position: any): void {
        // 创建暴击粒子效果
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

            // 创建粒子轨迹
            Instance.DebugLine({
                start: position,
                end: particlePos,
                duration: 0.5,
                color: { r: 255, g: 200, b: 0, a: 150 }
            });
        }
    }
}