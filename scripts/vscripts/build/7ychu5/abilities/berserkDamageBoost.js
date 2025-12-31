// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

const utils = {
    printl(a) { Instance.Msg(a); },
    EntFire(name = "", input = "", value = "", delay = 0.0, caller = undefined, activator = undefined) {
        Instance.EntFireAtName({ name, input, value, delay, caller, activator });
    },
    EntFireByHandle(target, input = "", value = "", delay = 0.0, caller = undefined, activator = undefined) {
        if (target == undefined)
            return;
        Instance.EntFireAtTarget({ target, input, value, delay, caller, activator });
    },
    GetRandomIntBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    vectorAdd(vec1, vec2) {
        return { x: vec1.x + vec2.x, y: vec1.y + vec2.y, z: vec1.z + vec2.z };
    },
    vectorScale(vec, scale) {
        return { x: vec.x * scale, y: vec.y * scale, z: vec.z * scale };
    },
    vectorDistance(vec) {
        return Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.y, 2) + Math.pow(vec.z, 2));
    },
    dotProduct(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    },
    normalizeVector(v) {
        const length = this.vectorDistance(v);
        if (length === 0)
            return { x: 0, y: 0, z: 0 };
        return { x: v.x / length, y: v.y / length, z: v.z / length };
    },
    angleToVector(angles) {
        const pitch = (angles.pitch * Math.PI) / 180;
        const yaw = (angles.yaw * Math.PI) / 180;
        return {
            x: Math.cos(yaw) * Math.cos(pitch),
            y: Math.sin(yaw) * Math.cos(pitch),
            z: -Math.sin(pitch)
        };
    }
};

class DamageModifierSystem {
    constructor() {
        this.modifiers = [];
        this.debugEnabled = true;
        Instance.OnBeforePlayerDamage((event) => {
            return this.processDamageModifiers(event);
        });
    }
    registerModifier(name, priority, modifier) {
        this.unregisterModifier(name);
        this.modifiers.push({ name, priority, modifier });
        this.modifiers.sort((a, b) => b.priority - a.priority);
        if (this.debugEnabled) {
            utils.printl(`注册伤害修改器: ${name} (优先级: ${priority})`);
        }
    }
    unregisterModifier(name) {
        const initialCount = this.modifiers.length;
        this.modifiers = this.modifiers.filter(m => m.name !== name);
        if (this.debugEnabled && initialCount !== this.modifiers.length) {
            utils.printl(`注销伤害修改器: ${name}`);
        }
    }
    setDebugEnabled(enabled) {
        this.debugEnabled = enabled;
        utils.printl(`伤害修改系统调试模式: ${enabled ? '开启' : '关闭'}`);
    }
    processDamageModifiers(event) {
        let modifiedEvent = Object.assign({}, event);
        let finalDamage = event.damage;
        if (!this.debugEnabled || this.modifiers.length === 0) {
            return { damage: finalDamage };
        }
        const debugSteps = [];
        debugSteps.push({
            modifierName: "初始伤害",
            beforeDamage: event.damage,
            afterDamage: event.damage,
            description: "基础伤害值"
        });
        for (const modifier of this.modifiers) {
            try {
                const beforeDamage = modifiedEvent.damage;
                const result = modifier.modifier(modifiedEvent);
                if (result && result.damage !== undefined) {
                    finalDamage = result.damage;
                    modifiedEvent.damage = finalDamage;
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: finalDamage,
                        description: result.description || "伤害修改"
                    });
                }
                else {
                    debugSteps.push({
                        modifierName: modifier.name,
                        beforeDamage: beforeDamage,
                        afterDamage: beforeDamage,
                        description: (result === null || result === void 0 ? void 0 : result.description) || "未修改伤害"
                    });
                }
            }
            catch (error) {
                debugSteps.push({
                    modifierName: modifier.name,
                    beforeDamage: modifiedEvent.damage,
                    afterDamage: modifiedEvent.damage,
                    description: `错误: ${error}`
                });
                utils.printl(`伤害修改器 ${modifier.name} 错误: ${error}`);
            }
        }
        this.displayDebugInfo(debugSteps, event);
        return { damage: finalDamage };
    }
    displayDebugInfo(debugSteps, originalEvent) {
        if (!this.debugEnabled || debugSteps.length <= 1) {
            return;
        }
        const attacker = originalEvent.attacker;
        const victim = originalEvent.player;
        let debugOutput = `伤害修改链 (`;
        if (attacker && victim) {
            const attackerName = attacker.GetEntityName() || "未知攻击者";
            const victimName = victim.GetEntityName() || "未知受害者";
            debugOutput += `${attackerName} → ${victimName}`;
        }
        debugOutput += `):\n`;
        for (let i = 0; i < debugSteps.length; i++) {
            const step = debugSteps[i];
            const arrow = i === 0 ? "┌─" : i === debugSteps.length - 1 ? "└─" : "├─";
            if (step.beforeDamage !== step.afterDamage) {
                debugOutput += `${arrow} ${step.modifierName}: ${step.beforeDamage} → ${step.afterDamage}`;
                if (step.description && step.description !== "伤害修改") {
                    debugOutput += ` (${step.description})`;
                }
            }
            else {
                debugOutput += `${arrow} ${step.modifierName}: ${step.description}`;
            }
            debugOutput += "\n";
        }
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;
        const totalChange = finalDamage - initialDamage;
        const changePercentage = ((totalChange / initialDamage) * 100).toFixed(1);
        debugOutput += `总计: ${initialDamage} → ${finalDamage} (${totalChange > 0 ? '+' : ''}${totalChange}, ${changePercentage}%)`;
        utils.printl(debugOutput);
        this.displayScreenDebugInfo(debugSteps);
    }
    displayScreenDebugInfo(debugSteps) {
        const initialDamage = debugSteps[0].beforeDamage;
        const finalDamage = debugSteps[debugSteps.length - 1].afterDamage;
        const modifiedSteps = debugSteps.filter(step => step.beforeDamage !== step.afterDamage && step.modifierName !== "初始伤害");
        if (modifiedSteps.length === 0) {
            return;
        }
        let screenText = `伤害: ${initialDamage} → ${finalDamage}\n`;
        for (const step of modifiedSteps) {
            const change = step.afterDamage - step.beforeDamage;
            screenText += `${step.modifierName}: ${change > 0 ? '+' : ''}${change}\n`;
        }
        Instance.DebugScreenText({
            text: screenText,
            x: 0.02,
            y: 0.02,
            duration: 3.0,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
    }
}
const damageModifierSystem = new DamageModifierSystem();

class BerserkDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "血量增伤";
        this.version = "1.0.0";
        this.currentMultiplier = 1.0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `berserk_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            minHealthThreshold: 20,
            maxDamageMultiplier: 5.0
        };
    }
    initialize() {
        utils.printl(`血量增伤已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyBerserkDamageBoost(event));
    }
    onGunFire(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.calculateDamageMultiplier();
        if (this.currentMultiplier > 1.0) {
            this.createBerserkFireEffects();
        }
    }
    calculateDamageMultiplier() {
        const playerInstance = this.getPlayer();
        if (!playerInstance || !playerInstance.isValid()) {
            this.currentMultiplier = 1.0;
            return;
        }
        const health = playerInstance.getHP();
        const maxHealth = playerInstance.getHPMAX();
        if (health <= 0 || maxHealth <= 0) {
            this.currentMultiplier = 1.0;
            return;
        }
        const healthPercent = (health / maxHealth) * 100;
        if (healthPercent > this.config.minHealthThreshold) {
            this.currentMultiplier = 1.0;
            return;
        }
        const progress = 1 - (healthPercent / this.config.minHealthThreshold);
        this.currentMultiplier = 1.0 + (this.config.maxDamageMultiplier - 1.0) * Math.pow(progress, 1.5);
    }
    applyBerserkDamageBoost(event) {
        var _a;
        if (!this.config.enabled || this.currentMultiplier <= 1.0)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);
        this.createBerserkAttackEffects((_a = event.player) === null || _a === void 0 ? void 0 : _a.GetAbsOrigin());
        const playerInstance = this.getPlayer();
        const health = playerInstance.getHP();
        const maxHealth = playerInstance.getHPMAX();
        const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
        return {
            damage: boostedDamage,
            description: `血量增伤! ×${this.currentMultiplier.toFixed(2)} (血量: ${Math.floor(healthPercent)}%)`
        };
    }
    update() {
        if (this.currentMultiplier > 1.0) {
            this.updateScreenHint();
        }
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 血量增伤能力已清理`);
    }
    onPlayerReset() {
        this.currentMultiplier = 1.0;
    }
    onPlayerDisconnect() {
        this.cleanup();
    }
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    getConfig() {
        return Object.assign({}, this.config);
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.currentMultiplier = 1.0;
        }
    }
    getStatus() {
        const playerInstance = this.getPlayer();
        const health = playerInstance ? playerInstance.getHP() : 0;
        const maxHealth = playerInstance ? playerInstance.getHPMAX() : 0;
        const healthPercent = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
        return {
            health: health,
            maxHealth: maxHealth,
            healthPercent: healthPercent,
            multiplier: this.currentMultiplier,
            isActive: this.currentMultiplier > 1.0
        };
    }
    createBerserkFireEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        const status = this.getStatus();
        const intensity = 1 - (status.healthPercent / this.config.minHealthThreshold);
        const radius = 25 + 25 * intensity;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.3,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugSphere({
            center: position,
            radius: radius + 15,
            duration: 0.5,
            color: { r: 255, g: 50, b: 50, a: 100 }
        });
        Instance.DebugScreenText({
            text: `血量增伤激活! 伤害: ${this.currentMultiplier.toFixed(2)}x`,
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
    }
    createBerserkAttackEffects(targetPosition) {
        if (!targetPosition)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const attackerPosition = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.3,
            color: { r: 255, g: 0, b: 0, a: 200 }
        });
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 180 }
        });
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * 2 * Math.PI;
            const startPos = {
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z
            };
            const endPos = {
                x: targetPosition.x + Math.cos(angle) * 35,
                y: targetPosition.y + Math.sin(angle) * 35,
                z: targetPosition.z
            };
            Instance.DebugLine({
                start: startPos,
                end: endPos,
                duration: 0.3,
                color: { r: 200, g: 0, b: 0, a: 150 }
            });
        }
    }
    updateScreenHint() {
        const status = this.getStatus();
        const healthText = `血量: ${Math.floor(status.health)}/${status.maxHealth} (${Math.floor(status.healthPercent)}%)`;
        const damageText = `血量增伤: ${status.multiplier.toFixed(2)}x`;
        Instance.DebugScreenText({
            text: `${healthText}\n${damageText}`,
            x: 0.02,
            y: 0.18,
            duration: 0.1,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
        if (status.healthPercent <= 15) {
            Instance.DebugScreenText({
                text: "警告! 濒死状态",
                x: 0.5,
                y: 0.4,
                duration: 0.1,
                color: { r: 255, g: 0, b: 0, a: 255 }
            });
        }
    }
}

export { BerserkDamageBoostAbility };
