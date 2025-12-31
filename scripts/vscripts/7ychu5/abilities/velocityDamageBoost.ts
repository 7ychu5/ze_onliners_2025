// velocityDamageBoost.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { damageModifierSystem } from "../abilities/damageModifierSystem";
import { utils } from "../utils";

// 速度增伤配置
export interface VelocityDamageBoostConfig extends AbilityConfig {
    minSpeed: number;           // 最小触发速度
    maxSpeed: number;           // 最大速度（达到此速度时获得最大加成）
    minDamageMultiplier: number; // 最小伤害倍率
    maxDamageMultiplier: number; // 最大伤害倍率
    checkInterval: number;      // 速度检查间隔
    considerZAxis: boolean;     // 是否考虑Z轴速度
}

export class VelocityDamageBoostAbility implements IAbility {
    public name: string = "速度增伤";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any;

    private config: VelocityDamageBoostConfig;
    private currentSpeed: number = 0;
    private currentMultiplier: number = 1.0;
    private lastSpeedCheck: number = 0;
    private modifierId: string;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `velocity_damage_boost_${this.playerId}`;

        this.config = {
            enabled: true,
            minSpeed: 100,      // 最小触发速度
            maxSpeed: 250,      // 最大速度
            minDamageMultiplier: 1.0,  // 最小倍率
            maxDamageMultiplier: 2.5,  // 最大倍率
            checkInterval: 0.1, // 每0.1秒检查一次速度
            considerZAxis: false // 默认考虑Z轴
        };
    }

    initialize(): void {
        utils.printl(`速度增伤能力已为玩家 ${this.playerId} 初始化 (Z轴: ${this.config.considerZAxis ? '开启' : '关闭'})`);

        // 注册伤害修改器
        damageModifierSystem.registerModifier(
            this.modifierId,
            5, // 中等优先级
            (event) => this.applyVelocityDamageBoost(event)
        );
    }

    update(): void {
        if (!this.config.enabled) return;

        const currentTime = Instance.GetGameTime();

        // 按间隔检查速度，避免每帧计算
        if (currentTime - this.lastSpeedCheck < this.config.checkInterval) {
            return;
        }

        this.lastSpeedCheck = currentTime;
        this.updatePlayerSpeed();
        this.updateDamageMultiplier();
        this.updateVisualEffects();
    }

    private updatePlayerSpeed(): void {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) {
            this.currentSpeed = 0;
            return;
        }

        // 获取当前速度
        const velocity = pawn.GetAbsVelocity();

        if (this.config.considerZAxis) {
            // 计算三维速度（考虑Z轴）
            this.currentSpeed = utils.vectorDistance(velocity);
        } else {
            // 只计算水平速度（忽略Z轴）
            this.currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        }
    }

    private updateDamageMultiplier(): void {
        if (this.currentSpeed < this.config.minSpeed) {
            this.currentMultiplier = 1.0;
            return;
        }

        if (this.currentSpeed >= this.config.maxSpeed) {
            this.currentMultiplier = this.config.maxDamageMultiplier;
            return;
        }

        // 线性插值计算伤害倍率
        const speedRange = this.config.maxSpeed - this.config.minSpeed;
        const speedProgress = (this.currentSpeed - this.config.minSpeed) / speedRange;
        const multiplierRange = this.config.maxDamageMultiplier - this.config.minDamageMultiplier;

        this.currentMultiplier = this.config.minDamageMultiplier + (speedProgress * multiplierRange);
    }

    private applyVelocityDamageBoost(event: any): any {
        if (!this.config.enabled) return;

        const attacker = event.attacker;

        // 检查攻击者是否是本玩家
        if (!attacker || attacker !== this.getPlayer().getPawn()) return;

        // 如果速度低于阈值，不应用加成
        if (this.currentSpeed < this.config.minSpeed) return;

        // 计算加成后的伤害
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);

        const speedType = this.config.considerZAxis ? "三维速度" : "水平速度";

        return {
            damage: boostedDamage,
            description: `速度增伤! ×${this.currentMultiplier.toFixed(2)} (${speedType}: ${Math.floor(this.currentSpeed)})`
        };
    }

    cleanup(): void {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 速度增伤能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
        this.currentSpeed = 0;
        this.currentMultiplier = 1.0;
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<VelocityDamageBoostConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): VelocityDamageBoostConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // Z轴开关方法
    setConsiderZAxis(enabled: boolean): void {
        this.config.considerZAxis = enabled;
        utils.printl(`玩家 ${this.playerId} 速度增伤Z轴计算: ${enabled ? '开启' : '关闭'}`);
    }

    // 获取当前状态
    getStatus(): { speed: number; multiplier: number; isActive: boolean; considerZAxis: boolean } {
        return {
            speed: this.currentSpeed,
            multiplier: this.currentMultiplier,
            isActive: this.currentSpeed >= this.config.minSpeed,
            considerZAxis: this.config.considerZAxis
        };
    }

    // 视觉效果
    private updateVisualEffects(): void {
        if (!this.config.enabled) return;

        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) return;

        const position = pawn.GetAbsOrigin();

        // 只在速度超过阈值时显示效果
        if (this.currentSpeed >= this.config.minSpeed) {
            // 根据倍率计算颜色强度
            const intensity = Math.floor(255 * (this.currentMultiplier - 1) / (this.config.maxDamageMultiplier - 1));
            const color = {
                r: intensity,
                g: 255 - intensity,
                b: 0,
                a: 100 + intensity
            };

            // 创建速度光环
            Instance.DebugSphere({
                center: position,
                radius: 20 + (intensity / 255) * 30, // 半径随速度增加
                duration: 0.1,
                color: color
            });

            // 显示速度矢量线
            const velocity = pawn.GetAbsVelocity();
            const normalizedVel = utils.normalizeVector(velocity);
            const endPos = {
                x: position.x + normalizedVel.x * 50,
                y: position.y + normalizedVel.y * 50,
                z: position.z + (this.config.considerZAxis ? normalizedVel.z * 50 : 0)
            };

            Instance.DebugLine({
                start: position,
                end: endPos,
                duration: 0.1,
                color: color
            });
        }

        // 更新屏幕提示
        this.updateScreenHint();
    }

    private updateScreenHint(): void {
        const speedType = this.config.considerZAxis ? "3D速度" : "2D速度";
        const statusText = this.currentSpeed >= this.config.minSpeed ?
            `速度增伤: ${this.currentMultiplier.toFixed(2)}x\n${speedType}: ${Math.floor(this.currentSpeed)}` :
            `${speedType}: ${Math.floor(this.currentSpeed)}`;

        Instance.DebugScreenText({
            text: statusText,
            x: 0.02,
            y: 0.12,
            duration: 0.1,
            color: this.currentSpeed >= this.config.minSpeed ?
                { r: 0, g: 255, b: 0, a: 255 } :
                { r: 150, g: 150, b: 150, a: 255 }
        });
    }
}