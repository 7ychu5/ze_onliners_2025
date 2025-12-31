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

class ReloadDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "换弹增伤";
        this.version = "1.0.0";
        this.isBoostActive = false;
        this.boostEndTime = 0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `reload_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            damageMultiplier: 2,
            boostDuration: 3.0,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`换弹伤害加成能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunReload((event) => {
            this.onGunReload(event);
        });
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyDamageBoost(event));
    }
    onGunReload(event) {
        const weapon = event.weapon;
        const owner = weapon.GetOwner();
        if (!owner || owner !== this.getPlayer().getPawn())
            return;
        if (!this.config.enabled)
            return;
        this.activateDamageBoost();
        utils.printl(`玩家 ${this.playerId} 换弹完成，获得 ${this.config.damageMultiplier}x 伤害加成`);
    }
    activateDamageBoost() {
        this.isBoostActive = true;
        this.boostEndTime = Instance.GetGameTime() + this.config.boostDuration;
        this.createBoostEffects();
    }
    applyDamageBoost(event) {
        if (!this.isBoostActive)
            return;
        const attacker = event.attacker;
        const currentTime = Instance.GetGameTime();
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (currentTime > this.boostEndTime) {
            this.isBoostActive = false;
            return;
        }
        const timeLeft = this.boostEndTime - currentTime;
        const timePercent = timeLeft / this.config.boostDuration;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        this.createDynamicEffects(timePercent);
        return {
            damage: boostedDamage,
            description: `换弹强化! ×${this.config.damageMultiplier} (${(timeLeft * 1000).toFixed(0)}ms)`
        };
    }
    update() {
        if (this.isBoostActive && Instance.GetGameTime() > this.boostEndTime) {
            this.isBoostActive = false;
            this.createExpireEffects();
            utils.printl(`玩家 ${this.playerId} 换弹伤害加成已结束`);
        }
        if (this.isBoostActive) {
            this.updateScreenHint();
        }
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        this.isBoostActive = false;
        utils.printl(`玩家 ${this.playerId} 换弹伤害加成能力已清理`);
    }
    onPlayerReset() {
        this.isBoostActive = false;
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
            this.isBoostActive = false;
        }
    }
    createBoostEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: position,
            radius: 50,
            duration: 0.5,
            color: { r: 0, g: 255, b: 255, a: 150 }
        });
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
        Instance.DebugScreenText({
            text: "换弹完成! 伤害加成激活",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 0, g: 255, b: 255, a: 255 }
        });
    }
    createDynamicEffects(timePercent) {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        const intensity = Math.floor(255 * timePercent);
        const color = {
            r: 0,
            g: intensity,
            b: 255,
            a: 100 + Math.floor(155 * timePercent)
        };
        const radius = 30 + 20 * timePercent;
        Instance.DebugSphere({
            center: position,
            radius: radius,
            duration: 0.1,
            color: color
        });
    }
    createExpireEffects() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        pawn.GetAbsOrigin();
        Instance.DebugScreenText({
            text: "伤害加成结束",
            x: 0.5,
            y: 0.3,
            duration: 1.0,
            color: { r: 255, g: 100, b: 0, a: 255 }
        });
    }
    updateScreenHint() {
        if (!this.isBoostActive)
            return;
        const timeLeft = this.boostEndTime - Instance.GetGameTime();
        const timeLeftMs = Math.max(0, timeLeft * 1000);
        Instance.DebugScreenText({
            text: `换弹伤害加成: ${this.config.damageMultiplier}x\n剩余: ${timeLeftMs.toFixed(0)}ms`,
            x: 0.02,
            y: 0.1,
            duration: 0.1,
            color: { r: 0, g: 200, b: 255, a: 255 }
        });
    }
    getStatus() {
        const timeLeft = this.isBoostActive ? Math.max(0, this.boostEndTime - Instance.GetGameTime()) : 0;
        return {
            isActive: this.isBoostActive,
            timeLeft: timeLeft
        };
    }
}

export { ReloadDamageBoostAbility };
