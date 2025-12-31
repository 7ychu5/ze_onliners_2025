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

class VelocityDamageBoostAbility {
    constructor(playerId, getPlayer) {
        this.name = "速度增伤";
        this.version = "1.0.0";
        this.currentSpeed = 0;
        this.currentMultiplier = 1.0;
        this.lastSpeedCheck = 0;
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.modifierId = `velocity_damage_boost_${this.playerId}`;
        this.config = {
            enabled: true,
            minSpeed: 100,
            maxSpeed: 250,
            minDamageMultiplier: 1.0,
            maxDamageMultiplier: 2.5,
            checkInterval: 0.1,
            considerZAxis: false
        };
    }
    initialize() {
        utils.printl(`速度增伤能力已为玩家 ${this.playerId} 初始化 (Z轴: ${this.config.considerZAxis ? '开启' : '关闭'})`);
        damageModifierSystem.registerModifier(this.modifierId, 5, (event) => this.applyVelocityDamageBoost(event));
    }
    update() {
        if (!this.config.enabled)
            return;
        const currentTime = Instance.GetGameTime();
        if (currentTime - this.lastSpeedCheck < this.config.checkInterval) {
            return;
        }
        this.lastSpeedCheck = currentTime;
        this.updatePlayerSpeed();
        this.updateDamageMultiplier();
        this.updateVisualEffects();
    }
    updatePlayerSpeed() {
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid()) {
            this.currentSpeed = 0;
            return;
        }
        const velocity = pawn.GetAbsVelocity();
        if (this.config.considerZAxis) {
            this.currentSpeed = utils.vectorDistance(velocity);
        }
        else {
            this.currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        }
    }
    updateDamageMultiplier() {
        if (this.currentSpeed < this.config.minSpeed) {
            this.currentMultiplier = 1.0;
            return;
        }
        if (this.currentSpeed >= this.config.maxSpeed) {
            this.currentMultiplier = this.config.maxDamageMultiplier;
            return;
        }
        const speedRange = this.config.maxSpeed - this.config.minSpeed;
        const speedProgress = (this.currentSpeed - this.config.minSpeed) / speedRange;
        const multiplierRange = this.config.maxDamageMultiplier - this.config.minDamageMultiplier;
        this.currentMultiplier = this.config.minDamageMultiplier + (speedProgress * multiplierRange);
    }
    applyVelocityDamageBoost(event) {
        if (!this.config.enabled)
            return;
        const attacker = event.attacker;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (this.currentSpeed < this.config.minSpeed)
            return;
        const boostedDamage = Math.floor(event.damage * this.currentMultiplier);
        const speedType = this.config.considerZAxis ? "三维速度" : "水平速度";
        return {
            damage: boostedDamage,
            description: `速度增伤! ×${this.currentMultiplier.toFixed(2)} (${speedType}: ${Math.floor(this.currentSpeed)})`
        };
    }
    cleanup() {
        damageModifierSystem.unregisterModifier(this.modifierId);
        utils.printl(`玩家 ${this.playerId} 速度增伤能力已清理`);
    }
    onPlayerReset() {
        this.currentSpeed = 0;
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
    }
    setConsiderZAxis(enabled) {
        this.config.considerZAxis = enabled;
        utils.printl(`玩家 ${this.playerId} 速度增伤Z轴计算: ${enabled ? '开启' : '关闭'}`);
    }
    getStatus() {
        return {
            speed: this.currentSpeed,
            multiplier: this.currentMultiplier,
            isActive: this.currentSpeed >= this.config.minSpeed,
            considerZAxis: this.config.considerZAxis
        };
    }
    updateVisualEffects() {
        if (!this.config.enabled)
            return;
        const pawn = this.getPlayer().getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const position = pawn.GetAbsOrigin();
        if (this.currentSpeed >= this.config.minSpeed) {
            const intensity = Math.floor(255 * (this.currentMultiplier - 1) / (this.config.maxDamageMultiplier - 1));
            const color = {
                r: intensity,
                g: 255 - intensity,
                b: 0,
                a: 100 + intensity
            };
            Instance.DebugSphere({
                center: position,
                radius: 20 + (intensity / 255) * 30,
                duration: 0.1,
                color: color
            });
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
        this.updateScreenHint();
    }
    updateScreenHint() {
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

export { VelocityDamageBoostAbility };
