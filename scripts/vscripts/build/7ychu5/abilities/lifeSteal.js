// s2ts v0.6.1
import { Instance } from 'cs_script/point_script';

const INT_MAX = 2147483647;
const C = {
    INT_MAX};

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

class LifeStealBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "吸血";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            lifeStealChance: 0.3,
            lifeStealRatio: 0.1,
            maxHealthLimit: C.INT_MAX,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`吸血能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnPlayerDamage((event) => {
            if (this.config.enabled) {
                this.onPlayerDamage(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 吸血能力已清理`);
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
    onPlayerDamage(event) {
        const attacker = event.attacker;
        event.player;
        const damage = event.damage;
        if (!attacker || attacker !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.lifeStealChance)
            return;
        const lifeStealAmount = Math.floor(damage * this.config.lifeStealRatio);
        if (lifeStealAmount <= 0)
            return;
        this.applyLifeSteal(lifeStealAmount);
        this.createLifeStealEffects(attacker, lifeStealAmount);
        utils.printl(`玩家 ${this.playerId} 吸血: +${lifeStealAmount} HP (${this.config.lifeStealRatio * 100}% 伤害)`);
    }
    applyLifeSteal(lifeStealAmount) {
        const player = this.getPlayer();
        if (!player)
            return;
        const currentHP = player.getHP();
        const maxHP = player.getHPMAX();
        if (currentHP < maxHP) {
            const newHealth = Math.min(currentHP + lifeStealAmount, maxHP);
            player.setHP(newHealth);
        }
        else {
            const newMaxHealth = Math.min(maxHP + lifeStealAmount, this.config.maxHealthLimit);
            if (newMaxHealth > maxHP) {
                player.setHPMAX(newMaxHealth);
                player.setHP(newMaxHealth);
                utils.printl(`玩家 ${this.playerId} 最大生命值提升: ${maxHP} -> ${newMaxHealth} (增加 ${lifeStealAmount})`);
            }
        }
    }
    createLifeStealEffects(attacker, lifeStealAmount) {
        const playerPos = attacker.GetAbsOrigin();
        Instance.DebugSphere({
            center: playerPos,
            radius: 20,
            duration: 1.0,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `吸血 +${lifeStealAmount} HP`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 50, b: 50, a: 255 }
        });
        this.createLifeStealParticles(playerPos);
    }
    createLifeStealParticles(position) {
        for (let i = 0; i < 5; i++) {
            const offset = {
                x: (Math.random() - 0.5) * 30,
                y: (Math.random() - 0.5) * 30,
                z: Math.random() * 20
            };
            const particlePos = {
                x: position.x + offset.x,
                y: position.y + offset.y,
                z: position.z + offset.z
            };
            Instance.DebugSphere({
                center: particlePos,
                radius: 3,
                duration: 0.5,
                color: { r: 255, g: 0, b: 0, a: 200 }
            });
        }
    }
    getHealthInfo() {
        const player = this.getPlayer();
        if (!player)
            return { hp: 0, hpmax: 0 };
        return {
            hp: player.getHP(),
            hpmax: player.getHPMAX()
        };
    }
}

export { LifeStealBulletAbility };
