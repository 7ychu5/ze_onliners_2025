// reloadDamageBoost.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { damageModifierSystem } from "../abilities/damageModifierSystem";
import { utils } from "../utils";

// 换弹伤害加成配置
export interface ReloadDamageBoostConfig extends AbilityConfig {
    damageMultiplier: number; // 伤害倍率
    boostDuration: number;    // 加成持续时间（秒）
}

export class ReloadDamageBoostAbility implements IAbility {
    public name: string = "换弹增伤";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any;

    private config: ReloadDamageBoostConfig;
    private isBoostActive: boolean = false;
    private boostEndTime: number = 0;
    private modifierId: string;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `reload_damage_boost_${this.playerId}`;

        this.config = {
            enabled: true,
            damageMultiplier: 2, // 1.5倍伤害
            boostDuration: 3.0,    // 1秒持续时间
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`换弹伤害加成能力已为玩家 ${this.playerId} 初始化`);

        // 监听换弹事件
        Instance.OnGunReload((event) => {
            this.onGunReload(event);
        });

        // 注册伤害修改器
        damageModifierSystem.registerModifier(
            this.modifierId,
            5, // 中等优先级
            (event) => this.applyDamageBoost(event)
        );
    }

    private onGunReload(event: any): void {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();

        // 检查武器拥有者是否是本玩家
        if (!owner || owner !== this.getPlayer().getPawn()) return;

        if (!this.config.enabled) return;

        // 激活伤害加成
        this.activateDamageBoost();

        utils.printl(`玩家 ${this.playerId} 换弹完成，获得 ${this.config.damageMultiplier}x 伤害加成`);
    }

    private activateDamageBoost(): void {
        this.isBoostActive = true;
        this.boostEndTime = Instance.GetGameTime() + this.config.boostDuration;

        // 创建视觉效果
        this.createBoostEffects();
    }

    private applyDamageBoost(event: any): any {
        if (!this.isBoostActive) return;

        const attacker = event.attacker;
        const currentTime = Instance.GetGameTime();

        // 检查攻击者是否是本玩家且加成仍在有效期内
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;
        if (currentTime > this.boostEndTime) {
            this.isBoostActive = false;
            return;
        }

        // 计算剩余时间百分比（用于视觉效果）
        const timeLeft = this.boostEndTime - currentTime;
        const timePercent = timeLeft / this.config.boostDuration;

        // 计算加成后的伤害
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);

        // 创建动态视觉效果
        this.createDynamicEffects(timePercent);

        return {
            damage: boostedDamage,
            description: `换弹强化! ×${this.config.damageMultiplier} (${(timeLeft * 1000).toFixed(0)}ms)`
        };
    }

    update(): void {
        // 检查加成是否过期
        if (this.isBoostActive && Instance.GetGameTime() > this.boostEndTime) {
            this.isBoostActive = false;
            this.createExpireEffects();
            utils.printl(`玩家 ${this.playerId} 换弹伤害加成已结束`);
        }

        // 更新屏幕提示（如果加成激活）
        if (this.isBoostActive) {
            this.updateScreenHint();
        }
    }

    cleanup(): void {
        // 注销伤害修改器
        damageModifierSystem.unregisterModifier(this.modifierId);

        this.isBoostActive = false;
        utils.printl(`玩家 ${this.playerId} 换弹伤害加成能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
        this.isBoostActive = false;
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<ReloadDamageBoostConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): ReloadDamageBoostConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        if (!enabled) {
            this.isBoostActive = false;
        }
    }

    // 视觉效果方法
    private createBoostEffects(): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();

        // 创建换弹完成光环效果
        Instance.DebugSphere({
            center: position,
            radius: 50,
            duration: 0.5,
            color: { r: 0, g: 255, b: 255, a: 150 } // 青色光环
        });

        // 创建向上扩散的粒子效果
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

        // 屏幕提示
        Instance.DebugScreenText({
            text: "换弹完成! 伤害加成激活",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 0, g: 255, b: 255, a: 255 }
        });
    }

    private createDynamicEffects(timePercent: number): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();

        // 根据剩余时间调整颜色强度
        const intensity = Math.floor(255 * timePercent);
        const color = {
            r: 0,
            g: intensity,
            b: 255,
            a: 100 + Math.floor(155 * timePercent)
        };

        // 创建动态光环（随剩余时间缩小）
        const radius = 30 + 20 * timePercent;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.1, // 短暂显示，下一帧会更新
            color: color
        });
    }

    private createExpireEffects(): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();

        // 屏幕提示
        Instance.DebugScreenText({
            text: "伤害加成结束",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 100, b: 0, a: 255 }
        });
    }

    private updateScreenHint(): void {
        if (!this.isBoostActive) return;

        const timeLeft = this.boostEndTime - Instance.GetGameTime();
        const timeLeftMs = Math.max(0, timeLeft * 1000);

        Instance.DebugScreenText({
            text: `换弹伤害加成: ${this.config.damageMultiplier}x\n剩余: ${timeLeftMs.toFixed(0)}ms`,
            x: 0.02,
            y: 0.1,
            duration: 0.1, // 每帧更新
            color: { r: 0, g: 200, b: 255, a: 255 }
        });
    }

    // 获取当前状态信息
    getStatus(): { isActive: boolean; timeLeft: number } {
        const timeLeft = this.isBoostActive ? Math.max(0, this.boostEndTime - Instance.GetGameTime()) : 0;
        return {
            isActive: this.isBoostActive,
            timeLeft: timeLeft
        };
    }
}