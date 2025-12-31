// payToWinAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";
import { damageModifierSystem } from "./damageModifierSystem";

// 付费赢家配置
export interface PayToWinConfig extends AbilityConfig {
    costPerShot: number; // 每发子弹消耗金钱
    damageMultiplier: number; // 伤害倍数
}

export class PayToWinAbility implements IAbility {
    public name: string = "挥金如土";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any;

    private config: PayToWinConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            costPerShot: 10, // 每发子弹10金钱
            damageMultiplier: 1.5, // 1.5倍伤害
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`付费赢家能力已为玩家 ${this.playerId} 初始化`);

        // 注册开枪事件监听
        Instance.OnGunFire((event) => {
            if (this.config.enabled) {
                this.onGunFire(event);
            }
        });

        // 注册伤害事件监听
        damageModifierSystem.registerModifier(
            `pay_to_win_${this.playerId}`,
            5, // 较低优先级
            (event) => this.applyDamageBoost(event)
        );
    }

    private applyDamageBoost(event: any): any {
        const attacker = event.attacker;
        const victim = event.player;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 检查受害者是否是敌人
        //if (!victim || victim.GetTeamNumber() === attacker.GetTeamNumber()) return;

        // 计算提升后的伤害
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);

        // 返回修改后的伤害和描述
        return {
            damage: boostedDamage,
            description: `付费伤害 ×${this.config.damageMultiplier}`
        };
    }

    update(): void {
        // 不需要每帧更新
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 付费赢家能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<PayToWinConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): PayToWinConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private onGunFire(event: any): void {
        const weapon = event.weapon;

        // 检查武器拥有者是否是本玩家
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn()) return;

        // 扣除金钱
        this.deductMoney();

        // 创建扣钱效果
        this.createCostEffect();
    }

    private deductMoney(): void {
        // 查找Game_money实体
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }

        // 设置扣钱金额
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.costPerShot.toString());

        // 从玩家扣除金钱
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.costPerShot.toString(), 0.00, undefined, this.getPlayer().getPawn());

        utils.printl(`玩家 ${this.playerId} 开枪扣钱: -$${this.config.costPerShot}`);
    }

    private createCostEffect(): void {
        const player = this.getPlayer();
        if (!player) return;

        const pawn = player.getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const playerPos = pawn.GetAbsOrigin();

        // 创建扣钱特效
        Instance.DebugSphere({
            center: playerPos,
            radius: 15,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });

        // 显示扣钱数值
        Instance.DebugScreenText({
            text: `-$${this.config.costPerShot}`,
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });

        // 创建金钱粒子效果
        this.createMoneyParticles(playerPos);
    }

    private createDamageBoostEffect(position: any, damage: number): void {
        // 创建付费伤害特效
        Instance.DebugSphere({
            center: position,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 215, b: 0, a: 200 } // 金色
        });

        // 显示付费伤害数值
        Instance.DebugScreenText({
            text: `$${damage}`,
            x: 0.5,
            y: 0.55,
            duration: 1.5,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }

    private createMoneyParticles(position: any): void {
        // 创建金钱粒子效果
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