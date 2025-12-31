// damageModifierSystem.ts
import { Instance } from "cs_script/point_script";
import { utils } from "../utils";

// ==================== 伤害修改器系统（带集中调试） ====================
class DamageModifierSystem {
    private modifiers: Array<{
        name: string;
        priority: number;
        modifier: (event: any) => any;
    }> = [];

    private debugEnabled: boolean = true; // 可配置的调试开关

    constructor() {
        Instance.OnBeforePlayerDamage((event) => {
            return this.processDamageModifiers(event);
        });
    }

    // 注册伤害修改器
    registerModifier(name: string, priority: number, modifier: (event: any) => any): void {
        // 防止重复注册
        this.unregisterModifier(name);

        this.modifiers.push({ name, priority, modifier });
        // 按优先级从高到低排序（数字大的在后面执行）
        this.modifiers.sort((a, b) => b.priority - a.priority);

        if (this.debugEnabled) {
            utils.printl(`注册伤害修改器: ${name} (优先级: ${priority})`);
        }
    }

    // 注销伤害修改器
    unregisterModifier(name: string): void {
        const initialCount = this.modifiers.length;
        this.modifiers = this.modifiers.filter(m => m.name !== name);

        if (this.debugEnabled && initialCount !== this.modifiers.length) {
            utils.printl(`注销伤害修改器: ${name}`);
        }
    }

    // 设置调试模式
    setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
        utils.printl(`伤害修改系统调试模式: ${enabled ? '开启' : '关闭'}`);
    }

    // 核心：处理所有伤害修改器
    private processDamageModifiers(event: any): any {
        // 1. 创建事件副本，避免污染原始事件
        let modifiedEvent = { ...event };
        let finalDamage = event.damage;

        // 2. 如果没有启用调试或者没有修改器，直接返回
        if (!this.debugEnabled || this.modifiers.length === 0) {
            return { damage: finalDamage };
        }

        // 3. 收集调试信息
        const debugSteps: Array<{
            modifierName: string;
            beforeDamage: number;
            afterDamage: number;
            description?: string;
        }> = [];

        // 记录初始状态
        debugSteps.push({
            modifierName: "初始伤害",
            beforeDamage: event.damage,
            afterDamage: event.damage,
            description: "基础伤害值"
        });

        // 4. 按顺序执行所有修改器
        for (const modifier of this.modifiers) {
            try {
                const beforeDamage = modifiedEvent.damage;
                const result = modifier.modifier(modifiedEvent);

                if (result && result.damage !== undefined) {
                    finalDamage = result.damage;
                    modifiedEvent.damage = finalDamage;

                    // 记录这次修改
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: finalDamage,
                        description: result.description || "伤害修改"
                    });
                } else {
                    // 即使没有修改伤害，也记录这个修改器被调用了
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: beforeDamage,
                        description: result?.description || "未修改伤害"
                    });
                }
            } catch (error) {
                // 记录错误信息
                debugSteps.push({
                    modifierName: modifier.name,
                    beforeDamage: modifiedEvent.damage,
                    afterDamage: modifiedEvent.damage,
                    description: `错误: ${error}`
                });

                utils.printl(`伤害修改器 ${modifier.name} 错误: ${error}`);
            }
        }

        // 5. 显示完整的调试信息
        this.displayDebugInfo(debugSteps, event);

        return { damage: finalDamage };
    }

    // 显示调试信息
    private displayDebugInfo(debugSteps: any[], originalEvent: any): void {
        if (!this.debugEnabled || debugSteps.length <= 1) {
            return;
        }

        const attacker = originalEvent.attacker;
        const victim = originalEvent.player;

        // 构建调试信息头部
        let debugOutput = `伤害修改链 (`;

        if (attacker && victim) {
            const attackerName = attacker.GetEntityName() || "未知攻击者";
            const victimName = victim.GetEntityName() || "未知受害者";
            debugOutput += `${attackerName} → ${victimName}`;
        }

        debugOutput += `):\n`;

        // 添加每个步骤的详细信息
        for (let i = 0; i < debugSteps.length; i++) {
            const step = debugSteps[i];
            const arrow = i === 0 ? "┌─" : i === debugSteps.length - 1 ? "└─" : "├─";

            if (step.beforeDamage !== step.afterDamage) {
                // 有伤害变化
                debugOutput += `${arrow} ${step.modifierName}: ${step.beforeDamage} → ${step.afterDamage}`;
                if (step.description && step.description !== "伤害修改") {
                    debugOutput += ` (${step.description})`;
                }
            } else {
                // 没有伤害变化
                debugOutput += `${arrow} ${step.modifierName}: ${step.description}`;
            }

            debugOutput += "\n";
        }

        // 显示最终总结
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;
        const totalChange = finalDamage - initialDamage;
        const changePercentage = ((totalChange / initialDamage) * 100).toFixed(1);

        debugOutput += `总计: ${initialDamage} → ${finalDamage} (${totalChange > 0 ? '+' : ''}${totalChange}, ${changePercentage}%)`;

        // 输出到控制台
        utils.printl(debugOutput);

        // 可选：在屏幕上显示简化版信息
        this.displayScreenDebugInfo(debugSteps);
    }

    // 在游戏屏幕上显示简化的调试信息
    private displayScreenDebugInfo(debugSteps: any[]): void {
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;

        // 只显示发生了修改的步骤
        const modifiedSteps = debugSteps.filter(step =>
            step.beforeDamage !== step.afterDamage && step.modifierName !== "初始伤害"
        );

        if (modifiedSteps.length === 0) {
            return; // 没有实际修改，不显示
        }

        let screenText = `伤害: ${initialDamage} → ${finalDamage}\n`;

        for (const step of modifiedSteps) {
            const change = step.afterDamage - step.beforeDamage;
            screenText += `${step.modifierName}: ${change > 0 ? '+' : ''}${change}\n`;
        }

        Instance.DebugScreenText({
            text: screenText,
            x: 0.02, // 左上角
            y: 0.02,
            duration: 3.0,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
    }
}

// 全局伤害修改系统实例
export const damageModifierSystem = new DamageModifierSystem();