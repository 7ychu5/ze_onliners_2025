// explosiveBulletAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 爆炸子弹配置
export interface ExplosiveBulletConfig extends AbilityConfig {
    explosionChance: number; // 爆炸触发概率 (0-1)
}

export class ExplosiveBulletAbility implements IAbility {
    public name: string = "爆炸子弹";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any; // 获取玩家实例的回调

    private config: ExplosiveBulletConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            explosionChance: 0.2, // 20%爆炸概率
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`爆炸子弹能力已为玩家 ${this.playerId} 初始化`);

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
        utils.printl(`玩家 ${this.playerId} 爆炸子弹能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<ExplosiveBulletConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): ExplosiveBulletConfig {
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

        // 检查爆炸触发概率
        if (Math.random() > this.config.explosionChance) return;

        // 触发爆炸效果
        this.createExplosion(position);

        utils.printl(`玩家 ${this.playerId} 触发爆炸子弹`);
    }

    private createExplosion(position: any): void {
        // 查找爆炸模板
        const template = Instance.FindEntityByName("template_explosive") as any;
        if (!template) {
            utils.printl("警告: 未找到爆炸模板 template_explosive");
            return;
        }

        // 在命中位置生成爆炸实体
        const spawned = template.ForceSpawn(position);
        if (spawned && spawned.length > 0) {
            const explosionEntity = spawned[0];

            // 对爆炸实体触发Explode输入
            utils.EntFireByHandle(explosionEntity, "Explode");
        }
    }
}