// stealMarkAbility.ts
import { Instance } from "cs_script/point_script";
import type { IAbility, AbilityConfig } from "../abilities/abilitiesSystem";
import { utils } from "../utils";

// 行窃标记配置
export interface StealMarkConfig extends AbilityConfig {
    stealAmount: number; // 窃取金额
    searchRadius: number; // 搜索半径
}

export class StealMarkAbility implements IAbility {
    public name: string = "行窃标记";
    public version: string = "1.0.0";

    private playerId: number;
    private getPlayer: () => any; // 获取玩家实例的回调

    private config: StealMarkConfig;

    constructor(playerId: number, getPlayer: () => any) {
        this.playerId = playerId;
        this.getPlayer = getPlayer;

        this.config = {
            enabled: true,
            stealAmount: 100, // 窃取100金钱
            searchRadius: 128, // 搜索半径128单位
            cooldown: 0
        };
    }

    initialize(): void {
        utils.printl(`行窃标记能力已为玩家 ${this.playerId} 初始化`);

        // 注册玩家标记事件监听
        Instance.OnPlayerPing((event) => {
            if (this.config.enabled) {
                this.onPlayerPing(event);
            }
        });
    }

    update(): void {
        // 不需要每帧更新
    }

    cleanup(): void {
        utils.printl(`玩家 ${this.playerId} 行窃标记能力已清理`);
    }

    onPlayerReset(): void {
        // 重置状态
    }

    onPlayerDisconnect(): void {
        this.cleanup();
    }

    // 配置相关方法
    setConfig(newConfig: Partial<StealMarkConfig>): void {
        Object.assign(this.config, newConfig);
    }

    getConfig(): StealMarkConfig {
        return Object.assign({}, this.config);
    }

    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    // 私有方法实现
    private onPlayerPing(event: any): void {
        const player = event.player;
        const position = event.position;

        // 检查标记玩家是否是本玩家
        if (!player || player !== this.getPlayer().getController()) return;

        // 搜索标记点附近的玩家
        const target = this.findNearestPlayer(position);
        if (!target) {
            utils.printl(`玩家 ${this.playerId} 标记位置附近没有找到目标`);
            return;
        }

        // 执行行窃
        this.executeSteal(player, target);

        utils.printl(`玩家 ${this.playerId} 对玩家 ${target.GetEntityName()} 使用行窃标记`);
    }

    private findNearestPlayer(position: any): any {
        const allPlayers = Instance.FindEntitiesByClass("player");
        let nearestPlayer = null;
        let minDistance = this.config.searchRadius;

        for (const player of allPlayers) {
            // 跳过自己和无效玩家
            if (!player.IsValid() || player === this.getPlayer().getPawn()) continue;

            // 计算距离
            const distance = this.getDistance(position, player.GetAbsOrigin());
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        }

        return nearestPlayer;
    }

    private executeSteal(attacker: any, victim: any): void {
        // 查找Game_money实体
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }

        attacker = attacker.GetPlayerPawn()

        // 设置窃取金额
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.stealAmount.toString(), 0.00, undefined, undefined);

        // 从受害者扣除金钱（设置受害者为激活者）
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.stealAmount.toString(), 0.00, undefined, victim);

        // 给攻击者增加金钱（设置攻击者为激活者）
        utils.EntFireByHandle(gameMoney, "AddMoneyPlayer", "", 0.00, undefined, attacker);

        // 创建视觉效果
        this.createStealEffects(attacker.GetAbsOrigin(), victim.GetAbsOrigin());
    }

    private createStealEffects(attackerPos: any, victimPos: any): void {
        // 创建行窃连线效果
        Instance.DebugLine({
            start: victimPos,
            end: attackerPos,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 } // 金色
        });

        // 在受害者位置创建效果
        Instance.DebugSphere({
            center: victimPos,
            radius: 20,
            duration: 2.0,
            color: { r: 255, g: 0, b: 0, a: 150 } // 红色
        });

        // 在攻击者位置创建效果
        Instance.DebugSphere({
            center: attackerPos,
            radius: 20,
            duration: 2.0,
            color: { r: 0, g: 255, b: 0, a: 150 } // 绿色
        });

        // 显示窃取金额
        Instance.DebugScreenText({
            text: `行窃 +$${this.config.stealAmount}`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }

    private getDistance(pos1: any, pos2: any): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}