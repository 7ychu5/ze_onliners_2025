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

class RicochetBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "弹射子弹";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            ricochetChance: 0.7,
            damageRatio: 0.5,
            searchRadius: 256,
            maxTargets: 3,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`跳弹子弹能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnBulletImpact((event) => {
            if (this.config.enabled) {
                this.onBulletImpact(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 跳弹子弹能力已清理`);
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
    onBulletImpact(event) {
        const weapon = event.weapon;
        const position = event.position;
        if (!weapon || weapon.GetOwner() !== this.getPlayer().getPawn())
            return;
        if (Math.random() > this.config.ricochetChance)
            return;
        const weaponData = weapon.GetData();
        if (!weaponData)
            return;
        const baseDamage = weaponData.GetDamage();
        const ricochetDamage = Math.floor(baseDamage * this.config.damageRatio);
        const targets = this.findTargets(position);
        this.applyRicochetDamage(position, targets, ricochetDamage, weapon);
        utils.printl(`玩家 ${this.playerId} 触发跳弹子弹，击中 ${targets.length} 个目标`);
    }
    findTargets(impactPosition) {
        const player = this.getPlayer();
        if (!player)
            return [];
        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid())
            return [];
        const allPlayers = Instance.FindEntitiesByClass("player");
        const targets = [];
        for (const targetPlayer of allPlayers) {
            if (!targetPlayer.IsValid() ||
                targetPlayer === attacker) {
                continue;
            }
            const distance = this.getDistance(impactPosition, targetPlayer.GetAbsOrigin());
            if (distance <= this.config.searchRadius) {
                targets.push(targetPlayer);
                if (targets.length >= this.config.maxTargets) {
                    break;
                }
            }
        }
        return targets;
    }
    applyRicochetDamage(impactPosition, targets, damage, weapon) {
        const player = this.getPlayer();
        if (!player)
            return;
        const attacker = player.getPawn();
        if (!attacker || !attacker.IsValid())
            return;
        for (const target of targets) {
            if (!target.IsValid())
                continue;
            const damageInfo = {
                damage: damage,
                inflictor: attacker,
                attacker: attacker,
                weapon: weapon
            };
            target.TakeDamage(damageInfo);
            this.createRicochetEffect(impactPosition, utils.vectorAdd(target.GetAbsOrigin(), { x: 0, y: 0, z: 48 }));
            this.createDamageIndicator(target.GetAbsOrigin(), damage);
        }
    }
    createRicochetEffect(startPos, endPos) {
        Instance.DebugLine({
            start: startPos,
            end: endPos,
            duration: 1.0,
            color: { r: 0, g: 200, b: 255, a: 255 }
        });
        Instance.DebugSphere({
            center: startPos,
            radius: 10,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 200 }
        });
        Instance.DebugSphere({
            center: endPos,
            radius: 8,
            duration: 1.0,
            color: { r: 0, g: 100, b: 255, a: 200 }
        });
    }
    createDamageIndicator(position, damage) {
        Instance.DebugScreenText({
            text: damage.toString(),
            x: 0.5,
            y: 0.5,
            duration: 1.0,
            color: { r: 0, g: 150, b: 255, a: 255 }
        });
    }
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

export { RicochetBulletAbility };
