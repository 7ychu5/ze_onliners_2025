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

class StealMarkAbility {
    constructor(playerId, getPlayer) {
        this.name = "行窃标记";
        this.version = "1.0.0";
        this.playerId = playerId;
        this.getPlayer = getPlayer;
        this.config = {
            enabled: true,
            stealAmount: 100,
            searchRadius: 128,
            cooldown: 0
        };
    }
    initialize() {
        utils.printl(`行窃标记能力已为玩家 ${this.playerId} 初始化`);
        Instance.OnPlayerPing((event) => {
            if (this.config.enabled) {
                this.onPlayerPing(event);
            }
        });
    }
    update() {
    }
    cleanup() {
        utils.printl(`玩家 ${this.playerId} 行窃标记能力已清理`);
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
    onPlayerPing(event) {
        const player = event.player;
        const position = event.position;
        if (!player || player !== this.getPlayer().getController())
            return;
        const target = this.findNearestPlayer(position);
        if (!target) {
            utils.printl(`玩家 ${this.playerId} 标记位置附近没有找到目标`);
            return;
        }
        this.executeSteal(player, target);
        utils.printl(`玩家 ${this.playerId} 对玩家 ${target.GetEntityName()} 使用行窃标记`);
    }
    findNearestPlayer(position) {
        const allPlayers = Instance.FindEntitiesByClass("player");
        let nearestPlayer = null;
        let minDistance = this.config.searchRadius;
        for (const player of allPlayers) {
            if (!player.IsValid() || player === this.getPlayer().getPawn())
                continue;
            const distance = this.getDistance(position, player.GetAbsOrigin());
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        }
        return nearestPlayer;
    }
    executeSteal(attacker, victim) {
        const gameMoney = Instance.FindEntityByName("Game_money");
        if (!gameMoney) {
            utils.printl("警告: 未找到Game_money实体");
            return;
        }
        attacker = attacker.GetPlayerPawn();
        utils.EntFireByHandle(gameMoney, "SetMoneyAmount", this.config.stealAmount.toString(), 0.00, undefined, undefined);
        utils.EntFireByHandle(gameMoney, "SpendMoneyFromPlayer", this.config.stealAmount.toString(), 0.00, undefined, victim);
        utils.EntFireByHandle(gameMoney, "AddMoneyPlayer", "", 0.00, undefined, attacker);
        this.createStealEffects(attacker.GetAbsOrigin(), victim.GetAbsOrigin());
    }
    createStealEffects(attackerPos, victimPos) {
        Instance.DebugLine({
            start: victimPos,
            end: attackerPos,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
        Instance.DebugSphere({
            center: victimPos,
            radius: 20,
            duration: 2.0,
            color: { r: 255, g: 0, b: 0, a: 150 }
        });
        Instance.DebugSphere({
            center: attackerPos,
            radius: 20,
            duration: 2.0,
            color: { r: 0, g: 255, b: 0, a: 150 }
        });
        Instance.DebugScreenText({
            text: `行窃 +$${this.config.stealAmount}`,
            x: 0.5,
            y: 0.5,
            duration: 2.0,
            color: { r: 255, g: 215, b: 0, a: 255 }
        });
    }
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

export { StealMarkAbility };
