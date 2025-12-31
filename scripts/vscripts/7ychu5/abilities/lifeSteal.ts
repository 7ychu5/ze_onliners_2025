// lifeStealBulletAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "./abilitiesSystem";
import { C } from "../constants";
import { utils } from "../utils";

// 吸血子弹配置
export interface LifeStealBulletConfig extends AbilityConfig {
    lifeStealChance: number; // 吸血触发概率 (0-1)
    lifeStealRatio: number; // 吸血比例 (0-1)
    maxHealthLimit: number; // 最大生命值上限
}

export class LifeStealBulletAbility implements IAbility {
    public name: string = "吸血";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any; // 获取玩家实例的回调

    private config: LifeStealBulletConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            lifeStealChance: 0.3, // 100%触发概率
            lifeStealRatio: 0.1, // 30%吸血
            maxHealthLimit: C.INT_MAX, // 最大生命值上限2147483647
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`吸血能力已为玩家 ${this.playerId} 初始化`);

        // 注册伤害事件监听
        Instance.OnPlayerDamage((event) => {
            if (this.config.enabled) {
                this.onPlayerDamage(event);
            }
        });
    }

    update(): void {
        // 不需要每帧更新
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 吸血能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<LifeStealBulletConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): LifeStealBulletConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private onPlayerDamage(event: any): void {
        const attacker = event.attacker;
        const victim = event.player;
        const damage = event.damage;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 检查受害者是否是敌人（不同队伍）
        //if (!victim || victim.GetTeamNumber() === attacker.GetTeamNumber()) return;

        // 检查吸血触发概率
        if (Math.random() > this.config.lifeStealChance) return;

        // 计算吸血量
        const lifeStealAmount = Math.floor(damage * this.config.lifeStealRatio);

        if (lifeStealAmount <= 0) return;

        // 应用吸血效果
        this.applyLifeSteal(lifeStealAmount);

        // 显示吸血效果
        this.createLifeStealEffects(attacker, lifeStealAmount);

        utils.printl(`玩家 ${this.playerId} 吸血: +${lifeStealAmount} HP (${this.config.lifeStealRatio * 100}% 伤害)`);
    }

    private applyLifeSteal(lifeStealAmount: number): void {
        const player = this.getPlayer();
        if (!player) return;

        const currentHP = player.getHP();
        const maxHP = player.getHPMAX();

        if (currentHP < maxHP) {
            // 血量未满，直接恢复
            const newHealth = Math.min(currentHP + lifeStealAmount, maxHP);
            player.setHP(newHealth);
        } else {
            // 血量已满，提升最大生命值，提升量等于吸血量
            const newMaxHealth = Math.min(maxHP + lifeStealAmount, this.config.maxHealthLimit);

            if (newMaxHealth > maxHP) {
                player.setHPMAX(newMaxHealth);
                player.setHP(newMaxHealth); // 恢复满血

                utils.printl(`玩家 ${this.playerId} 最大生命值提升: ${maxHP} -> ${newMaxHealth} (增加 ${lifeStealAmount})`);
            }
        }
    }

    private createLifeStealEffects(attacker: any, lifeStealAmount: number): void {
        const playerPos = attacker.GetAbsOrigin();

        // 创建吸血特效
        Instance.DebugSphere({
            center: playerPos,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });

        // 显示吸血数值
        Instance.DebugScreenText({
            text: `吸血 +${lifeStealAmount} HP`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 50, b: 50, a: 255 }
        });

        // 创建粒子效果
        this.createLifeStealParticles(playerPos);
    }

    private createLifeStealParticles(position: any): void {
        // 创建吸血粒子效果
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

    // 获取当前血量信息（用于调试）
    getHealthInfo(): { hp: number, hpmax: number } {
        const player = this.getPlayer();
        if (!player) return { hp: 0, hpmax: 0 };

        return {
            hp: player.getHP(),
            hpmax: player.getHPMAX()
        };
    }
}