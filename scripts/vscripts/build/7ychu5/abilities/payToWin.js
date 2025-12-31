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

class PayToWinAbility {
    constructor(playerId, getPlayer) {
        this.name = "挥金如土";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            costPerShot: 10,
            damageMultiplier: 1.5,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`付费赢家能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnGunFire((event) => {
            if (this.config.enabled) {
                this.onGunFire(event);
            }
        });
        damageModifierSystem.registerModifier(`pay_to_win_${this.playerId}`, 5, (event) => this.applyDamageBoost(event));
    }
    applyDamageBoost(event) {
        const attacker = event.attacker;
        event.player;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        const boostedDamage = Math.floor(event.damage * this.config.damageMultiplier);
        return {
            damage: boostedDamage,
            description: `付费伤害 ×${this.config.damageMultiplier}`
        };
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 付费赢家能力已清理`);
    }
    onPlayerReset() {
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
    onGunFire(event) {
        const weapon = event.weapon;
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn())
            return;
        this.deductMoney();
        this.createCostEffect();
    }
    deductMoney() {
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.costPerShot.toString());
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.costPerShot.toString(), 0.00, undefined, this.getPlayer().getPawn());
        utils.printl(`玩家 ${this.playerId} 开枪扣钱: -$${this.config.costPerShot}`);
    }
    createCostEffect() {
        const player = this.getPlayer();
        if (!player)
            return;
        const pawn = player.getPawn();
        if (!pawn || !pawn.IsValid())
            return;
        const playerPos = pawn.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 15,
            duration: 0.5,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `-$${this.config.costPerShot}`,
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 255 }
        });
        this.createMoneyParticles(playerPos);
    }
    createDamageBoostEffect(position, damage) {
        Instance.DebugSphere({
            center: position,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 215, b: 0, a: 200 }
        });
        Instance.DebugScreenText({
            text: `$${damage}`,
            x: 0.5,
            y: 0.55,
            duration: 1.5,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }
    createMoneyParticles(position) {
        for (let i = 0; i < 5; i++) {
            const offset = {
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 20,
                z: Math.random() * 30
            };
            const particlePos = {
                x: position.x + offset.x,
                y: position.y + offset.y,
                z: position.z + offset.z
            };
            Instance.DebugSphere({
                center: particlePos,
                radius: 2,
                duration: 0.8,
                color: { r: 255, g: 215, b: 0, a: 200 }
            });
        }
    }
}

export { PayToWinAbility };
