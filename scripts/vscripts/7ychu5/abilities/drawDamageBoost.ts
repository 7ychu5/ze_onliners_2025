// drawDamageBoost.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { damageModifierSystem } from "../abilities/damageModifierSystem";
import { utils } from "../utils";

// 切枪增伤配置
export interface DrawDamageBoostConfig extends AbilityConfig {
    damageMultiplier: number;   // 切枪后的伤害倍率
}

export class DrawDamageBoostAbility implements IAbility {
    public name: string = "切枪增伤";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any;

    private config: DrawDamageBoostConfig;
    private nextShotBoosted: boolean = false;
    private modifierId: string;
    private lastWeaponBeforeFire: string = ""; // 开枪前的武器

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `draw_damage_boost_${this.playerId}`;

        this.config = {
            enabled: true,
            damageMultiplier: 1.5  // 1.5倍伤害
        };
    }

    initialize(): void {
        utils.printl(`切枪增伤能力已为玩家 ${this.playerId} 初始化`);

        // 监听开枪事件
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });

        // 监听武器切换事件（通过监听玩家激活武器）
        Instance.OnPlayerActivate((event) => {
            // 玩家激活时重置状态
            this.resetState();
        });

        // 注册伤害修改器
        damageModifierSystem.registerModifier(
            this.modifierId,
            5, // 中等优先级
            (event) => this.applyDrawDamageBoost(event)
        );
    }

    private onGunFire(event: any): void {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();

        // 检查武器拥有者是否是本玩家
        if (!owner || owner !== this.getPlayer().getPawn()) return;

        if (!this.config.enabled) return;

        const playerInstance = this.getPlayer();
        const currentWeapon = weapon.GetClassName();

        // 如果是第一次记录，只记录不检查
        if (this.lastWeaponBeforeFire === "") {
            this.lastWeaponBeforeFire = currentWeapon;
            return;
        }

        // 检查是否切换了武器
        if (this.lastWeaponBeforeFire !== currentWeapon) {
            // 标记下一发子弹增伤
            this.nextShotBoosted = true;

            // 创建切枪特效（只在切枪时创建一次）
            this.createWeaponSwitchEffects();

            utils.printl(`玩家 ${this.playerId} 切枪，下一发子弹获得 ${this.config.damageMultiplier}x 伤害加成`);
        }

        // 更新记录
        this.lastWeaponBeforeFire = currentWeapon;
    }

    private applyDrawDamageBoost(event: any): any {
        if (!this.config.enabled || !this.nextShotBoosted) return;

        const attacker = event.attacker;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 计算加成后的伤害
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);

        // 创建单次攻击特效
        this.createSingleShotEffects(event.player?.GetAbsOrigin());

        // 立即重置状态，只对第一颗子弹有效
        this.nextShotBoosted = false;

        return {
            damage: boostedDamage,
            description: `切枪增伤! ×${this.config.damageMultiplier}`
        };
    }

    update(): void {
        // 这个实现不需要每帧更新，性能开销极低
        // 只更新屏幕提示
        this.updateScreenHint();
    }

    cleanup(): void {
        // 注销伤害修改器
        damageModifierSystem.unregisterModifier(this.modifierId);

        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
        utils.printl(`玩家 ${this.playerId} 切枪增伤能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
        this.resetState();
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    private resetState(): void {
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
    }

    // 配置相关方法
    setConfig(newConfig: Partial<DrawDamageBoostConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): DrawDamageBoostConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        if (!enabled) {
            this.nextShotBoosted = false;
        }
    }

    // 视觉效果方法 - 只在关键事件触发
    private createWeaponSwitchEffects(): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();

        // 创建切枪完成光环效果（只显示一次）
        Instance.DebugSphere({
            center: position,
            radius: 60,
            duration: 1.0, // 显示1秒
            color: { r: 255, g: 0, b: 255, a: 150 } // 紫色光环
        });

        // 屏幕提示
        Instance.DebugScreenText({
            text: "切枪完成! 下一发子弹增伤",
            x: 0.5,
            y: 0.3,
            duration: 2.0,
            color: { r: 255, g: 0, b: 255, a: 255 }
        });
    }

    private createSingleShotEffects(targetPosition: any): void {
        if (!targetPosition) return;

        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const attackerPosition = pawn.GetAbsOrigin();

        // 创建从攻击者到目标的特效连线
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.5,
            color: { r: 255, g: 0, b: 255, a: 200 }
        });

        // 在目标位置创建切枪攻击特效
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.8,
            color: { r: 255, g: 0, b: 255, a: 180 }
        });
    }

    private updateScreenHint(): void {
        // 只在有加成时显示提示，减少不必要的屏幕更新
        if (this.nextShotBoosted) {
            Instance.DebugScreenText({
                text: `切枪增伤: 下一发子弹 ${this.config.damageMultiplier}x`,
                x: 0.02,
                y: 0.16,
                duration: 0.1,
                color: { r: 255, g: 0, b: 255, a: 255 }
            });
        }
    }

    // 获取当前状态信息
    getStatus(): { nextShotBoosted: boolean; lastWeapon: string; currentWeapon: string } {
        return {
            nextShotBoosted: this.nextShotBoosted,
            lastWeapon: this.lastWeaponBeforeFire,
            currentWeapon: this.getPlayer().getCurrentWeapon()
        };
    }
}