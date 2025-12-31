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

class DrawDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "切枪增伤";
        this.version = "1.0.0";
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `draw_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            damageMultiplier: 1.5
        };
    }
    initialize() {
        utils.printl(`切枪增伤能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            this.onGunFire(event);
        });
        Instance.OnPlayerActivate((event) => {
            this.resetState();
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyDrawDamageBoost(event));
    }
    onGunFire(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.getPlayer();
        const currentWeapon = weapon.GetClassName();
        if (this.lastWeaponBeforeFire === "") {
            this.lastWeaponBeforeFire = currentWeapon;
            return;
        }
        if (this.lastWeaponBeforeFire !== currentWeapon) {
            this.nextShotBoosted = true;
            this.createWeaponSwitchEffects();
            utils.printl(`玩家 ${this.playerId} 切枪，下一发子弹获得 ${this.config.damageMultiplier}x 伤害加成`);
        }
        this.lastWeaponBeforeFire = currentWeapon;
    }
    applyDrawDamageBoost(event) {
        var _a;
        if (!this.config.enabled || !this.nextShotBoosted)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        this.createSingleShotEffects((_a = event.player) === null || _a === void 0 ? void 0 : _a.GetAbsOrigin());
        this.nextShotBoosted = false;
        return {
            damage: boostedDamage,
            description: `切枪增伤! ×${this.config.damageMultiplier}`
        };
    }
    update() {
        this.updateScreenHint();
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
        utils.printl(`玩家 ${this.playerId} 切枪增伤能力已清理`);
    }
    onPlayerReset() {
        this.resetState();
    }
    onPlayerDisconnect() {
        this.cleanup();
    }
    resetState() {
        this.nextShotBoosted = false;
        this.lastWeaponBeforeFire = "";
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
            this.nextShotBoosted = false;
        }
    }
    createWeaponSwitchEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: position,
            radius: 60,
            duration: 1.0,
            color: { r: 255, g: 0, b: 255, a: 150 }
        });
        Instance.DebugScreenText({
            text: "切枪完成! 下一发子弹增伤",
            x: 0.5,
            y: 0.3,
            duration: 2.0,
            color: { r: 255, g: 0, b: 255, a: 255 }
        });
    }
    createSingleShotEffects(targetPosition) {
        if (!targetPosition)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const attackerPosition = pawn.GetAbsOrigin();
        Instance.DebugLine({
            start: attackerPosition,
            end: targetPosition,
            duration: 0.5,
            color: { r: 255, g: 0, b: 255, a: 200 }
        });
        Instance.DebugSphere({
            center: targetPosition,
            radius: 25,
            duration: 0.8,
            color: { r: 255, g: 0, b: 255, a: 180 }
        });
    }
    updateScreenHint() {
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
    getStatus() {
        return {
            nextShotBoosted: this.nextShotBoosted,
            lastWeapon: this.lastWeaponBeforeFire,
            currentWeapon: this.getPlayer().getCurrentWeapon()
        };
    }
}

export { DrawDamageBoostAbility };
