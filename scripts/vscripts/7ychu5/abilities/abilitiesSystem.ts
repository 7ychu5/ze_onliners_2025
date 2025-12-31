// abilitySystem.ts
import { Instance } from "cs_script/point_script";
import { utils } from "../utils";

// 简化接口 - 避免复杂语法
export interface IAbility {
    name: string;
    version: string;
    initialize(): void;
    update(): void;
    cleanup(): void;
    onPlayerReset(): void;
    onPlayerDisconnect(): void;
}

// 简化配置
export interface AbilityConfig {
    enabled: boolean;
    cooldown?: number;
}

// 能力管理器
export class AbilityManager {
    private abilities: Map<string, IAbility>;
    private playerId: number;

    constructor(playerId: number) {
        this.playerId = playerId;
        this.abilities = new Map();
    }

    // 注册能力
    registerAbility(ability: IAbility): void {
        if (this.abilities.has(ability.name)) {
            utils.printl(`玩家 ${this.playerId} 能力 ${ability.name} 已存在，跳过注册`);
            return;
        }

        this.abilities.set(ability.name, ability);
        ability.initialize();
        utils.printl(`玩家 ${this.playerId} 注册能力: ${ability.name} v${ability.version}`);
    }

    // 注销能力
    unregisterAbility(abilityName: string): void {
        const ability = this.abilities.get(abilityName);
        if (ability) {
            ability.cleanup();
            this.abilities.delete(abilityName);
            utils.printl(`玩家 ${this.playerId} 注销能力: ${abilityName}`);
        }
    }

    // 获取能力
    getAbility(abilityName: string): IAbility | undefined {
        return this.abilities.get(abilityName);
    }

    // 更新所有能力
    updateAll(): void {
        for (const ability of this.abilities.values()) {
            try {
                ability.update();
            } catch (error) {
                utils.printl(`玩家 ${this.playerId} 能力 ${ability.name} 更新错误: ${error}`);
            }
        }
    }

    // 玩家重置时调用
    onPlayerReset(): void {
        for (const ability of this.abilities.values()) {
            ability.onPlayerReset();
        }
    }

    // 玩家断开时调用
    onPlayerDisconnect(): void {
        for (const ability of this.abilities.values()) {
            ability.onPlayerDisconnect();
        }
    }

    // 获取所有能力名称
    getAbilityNames(): string[] {
        return Array.from(this.abilities.keys());
    }

    // 清理所有能力
    cleanupAll(): void {
        for (const ability of this.abilities.values()) {
            ability.cleanup();
        }
        this.abilities.clear();
    }
}