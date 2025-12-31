// ricochetBulletAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 跳弹子弹配置
export interface RicochetBulletConfig extends AbilityConfig {
    ricochetChance: number; // 跳弹触发概率 (0-1)
    damageRatio: number; // 伤害比例 (0-1)
    searchRadius: number; // 搜索半径
    maxTargets: number; // 最大目标数量
}

export class RicochetBulletAbility implements IAbility {
    public name: string = "弹射子弹";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any; // 获取玩家实例的回调

    private config: RicochetBulletConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            ricochetChance: 0.7, // 30%跳弹概率
            damageRatio: 0.5, // 50%伤害
            searchRadius: 256, // 搜索半径300单位
            maxTargets: 3, // 最多3个目标
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`跳弹子弹能力已为玩家 ${this.playerId} 初始化`);

        // 注册子弹击中事件监听
        Instance.OnBulletImpact((event) => {
            if (this.config.enabled) {
                this.onBulletImpact(event);
            }
        });
    }

    update(): void {
        // 不需要每帧更新
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 跳弹子弹能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<RicochetBulletConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): RicochetBulletConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private onBulletImpact(event: any): void {
        const weapon = event.weapon;
        const position = event.position;

        // 检查武器拥有者是否是本玩家
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn()) return;

        // 检查跳弹触发概率
        if (Math.random() > this.config.ricochetChance) return;

        // 获取武器数据
        const weaponData = weapon.GetData();
        if (!weaponData) return;

        // 获取武器基础伤害
        const baseDamage = weaponData.GetDamage();

        // 计算跳弹伤害
        const ricochetDamage = Math.floor(baseDamage * this.config.damageRatio);

        // 搜索周围的目标
        const targets = this.findTargets(position);

        // 对目标造成伤害
        this.applyRicochetDamage(position, targets, ricochetDamage, weapon);

        utils.printl(`玩家 ${this.playerId} 触发跳弹子弹，击中 ${targets.length} 个目标`);
    }

    private findTargets(impactPosition: any): any[] {
        const player = this.getPlayer();
        if (!player) return [];

        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid()) return [];

        const allPlayers = Instance.FindEntitiesByClass("player");
        const targets = [];

        for (const targetPlayer of allPlayers) {
            // 跳过无效玩家、自己和同队玩家
            if (!targetPlayer.IsValid() ||
                targetPlayer === attacker/* ||
                targetPlayer.GetTeamNumber() === attacker.GetTeamNumber()*/) {
                continue;
            }

            // 检查距离
            const distance = this.getDistance(impactPosition, targetPlayer.GetAbsOrigin());
            if (distance <= this.config.searchRadius) {
                targets.push(targetPlayer);

                // 达到最大目标数量时停止
                if (targets.length >= this.config.maxTargets) {
                    break;
                }
            }
        }

        return targets;
    }

    private applyRicochetDamage(impactPosition: any, targets: any[], damage: number, weapon: any): void {
        const player = this.getPlayer();
        if (!player) return;

        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid()) return;

        for (const target of targets) {
            if (!target.IsValid()) continue;

            // 对目标造成伤害
            const damageInfo = {
                damage: damage,
                inflictor: attacker,
                attacker: attacker,
                weapon: weapon
            };

            target.TakeDamage(damageInfo);

            // 创建视觉效果
            this.createRicochetEffect(impactPosition, utils.vectorAdd(target.GetAbsOrigin(), {x:0, y:0, z:48}));

            // 显示伤害数值
            this.createDamageIndicator(target.GetAbsOrigin(), damage);
        }
    }

    private createRicochetEffect(startPos: any, endPos: any): void {
        // 创建跳弹连线效果
        Instance.DebugLine({
            start: startPos,
            end: endPos,
            duration: 1.0,
            color: { r: 0, g: 200, b: 255, a: 255 }
        });

        // 在起点创建效果
        Instance.DebugSphere({
            center: startPos,
            radius: 10,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 200 }
        });

        // 在终点创建效果
        Instance.DebugSphere({
            center: endPos,
            radius: 8,
            duration: 1.0,
            color: { r: 0, g: 100, b: 255, a: 200 }
        });
    }

    private createDamageIndicator(position: any, damage: number): void {
        // 显示伤害数值
        Instance.DebugScreenText({
            text: damage.toString(),
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 255 }
        });
    }

    private getDistance(pos1: any, pos2: any): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}