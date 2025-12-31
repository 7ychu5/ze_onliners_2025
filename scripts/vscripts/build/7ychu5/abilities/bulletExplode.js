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

class ExplosiveBulletAbility {
    constructor(playerId, getPlayer) {
        this.name = "爆炸子弹";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            explosionChance: 0.2,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`爆炸子弹能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnBulletImpact((event) => {
            if (this.config.enabled) {
                this.onBulletImpact(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 爆炸子弹能力已清理`);
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
        if (Math.random() > this.config.explosionChance)
            return;
        this.createExplosion(position);
        utils.printl(`玩家 ${this.playerId} 触发爆炸子弹`);
    }
    createExplosion(position) {
        const template = Instance.FindEntityByName("template_explosive");
        if (!template) {
            utils.printl("警告: 未找到爆炸模板 template_explosive");
            return;
        }
        const spawned = template.ForceSpawn(position);
        if (spawned && spawned.length > 0) {
            const explosionEntity = spawned[0];
            utils.EntFireByHandle(explosionEntity, "Explode");
        }
    }
}

export { ExplosiveBulletAbility };
