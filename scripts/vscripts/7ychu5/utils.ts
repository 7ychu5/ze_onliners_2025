import { Entity, Instance, PointTemplate, type QAngle, type Vector } from "cs_script/point_script";
import { C } from "./constants";

export const utils = {
    printl(a: any) {Instance.Msg(a)},

    //Command(a: string, delay: number = 0.00) {this.EntFire("server", "Command", a, delay)},
    Command(a: string, delay?:number) {
        if(delay == undefined) Instance.ServerCommand(a)
        else{
            const server = Instance.FindEntityByClass("point_servercommand")
            utils.EntFireByHandle(server, "Command", a, delay)
        }
    },

    EntFire(name = "", input = "", value = "", delay = 0.0, caller:Entity|undefined = undefined, activator:Entity|undefined = undefined)
    {
        Instance.EntFireAtName({name,input,value,delay,caller,activator})
    },

    EntFireByHandle(target: Entity|undefined, input = "", value = "", delay = 0.0, caller:Entity|undefined = undefined, activator:Entity|undefined = undefined)
    {
        if(target == undefined) return;
        Instance.EntFireAtTarget({target,input,value,delay,caller,activator})
    },

    GetRandomIntBetween(min: number, max: number) {return Math.floor(Math.random() * (max - min + 1) ) + min;},

    SplitString(a:string,divide:string){return a.split(divide)},

    vectorAdd(vec1: Vector, vec2: Vector) {
        return { x: vec1.x + vec2.x, y: vec1.y + vec2.y, z: vec1.z + vec2.z };
    },

    vectorScale(vec: Vector, scale: number) {
        return { x: vec.x * scale, y: vec.y * scale, z: vec.z * scale };
    },

    vectorDistance(vec: Vector) {
        return Math.sqrt(Math.pow(vec.x,2)+Math.pow(vec.y,2)+Math.pow(vec.z,2))
    },

    dotProduct(a: Vector, b: Vector): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    },

    normalizeVector(v: Vector): any {
        const length = this.vectorDistance(v);
        if (length === 0) return { x: 0, y: 0, z: 0 };
        return { x: v.x / length, y: v.y / length, z: v.z / length };
    },

    angleToVector(angles: QAngle): any {
        const pitch = (angles.pitch * Math.PI) / 180;
        const yaw = (angles.yaw * Math.PI) / 180;
        return {
            x: Math.cos(yaw) * Math.cos(pitch),
            y: Math.sin(yaw) * Math.cos(pitch),
            z: -Math.sin(pitch)
        };
    },

    getForward(angles: QAngle) {
        const pitchRadians = (angles.pitch * Math.PI) / 180;
        const yawRadians = (angles.yaw * Math.PI) / 180;
        const hScale = Math.cos(pitchRadians);
        return {
            x: Math.cos(yawRadians) * hScale,
            y: Math.sin(yawRadians) * hScale,
            z: -Math.sin(pitchRadians),
        };
    },

    GetRandomPointInCircle3D(
        center: Vector,
        minRadius: number,
        maxRadius: number,
        minZ?: number,
        maxZ?: number
    ): Vector {
        minRadius = Math.max(0, minRadius);
        maxRadius = Math.max(minRadius + 0.1, maxRadius);

        const randomRadius = Math.sqrt(
            Math.random() * (Math.pow(maxRadius, 2) - Math.pow(minRadius, 2)) + Math.pow(minRadius, 2)
        );

        const angle = Math.random() * 2 * Math.PI;

        const x = center.x + randomRadius * Math.cos(angle);
        const y = center.y + randomRadius * Math.sin(angle);

        let z = center.z;
        if (minZ !== undefined && maxZ !== undefined) {
            z = this.GetRandomIntBetween(minZ, maxZ);
        }

        return { x, y, z };
    },

    fadeAndKill(ent: Entity | String | undefined) {
        if (ent instanceof Entity) {
            let time = 0.00
            while(time < 1.00){
                time += 0.02;
                utils.EntFireByHandle(ent, "Alpha", (255-time*255).toString(), time);
            }
            utils.EntFireByHandle(ent, "Kill", "", 1.0);
        } else if (typeof ent === "string") {
            let time = 0.0
            while(time < 1.0){
                time += 0.02;
                utils.EntFire(ent, "Alpha", (255-time*255).toString(), time);
            }
            utils.EntFire(ent, "Kill", "", 1.0);
        } else if (ent === undefined) {
            utils.printl("fadeAndKill undefined")
        } else {return;}
    },

    fadeAndSpawn(ent: Entity | String | undefined){
        if (ent instanceof Entity) {
            let time = 0.00
            while(time < 1.00){
                time += 0.02;
                utils.EntFireByHandle(ent, "Alpha", (time*255).toString(), time);
            }
        } else if (typeof ent === "string") {
            let time = 0.0
            while(time < 1.0){
                time += 0.02;
                utils.EntFire(ent, "Alpha", (time*255).toString(), time);
            }
            utils.EntFire(ent, "Kill", "", 1.0);
        } else if (ent === undefined) {
            utils.printl("fadeAndKill undefined")
        } else {return;}
    },


    //////////////////////////////////

    EmitSound(soundevent: string, origin?: Vector){
        const tempOrigin = origin ?? C.WorldOrigin; // 使用空值合并运算符
        const template_sound = Instance.FindEntityByName("template_sound") as PointTemplate
        if(template_sound == undefined){utils.printl("template_sound 不存在");return;}
        const ent = template_sound.ForceSpawn(tempOrigin)
        if(ent == undefined || ent.length <= 0){utils.printl("template_sound 里的东西 不存在");return;}
        ent!.forEach(element => {
            utils.EntFireByHandle(element, "SetSoundEventName", soundevent)
            utils.EntFireByHandle(element, "StartSound", "", C.ttick)
        });
        return;
    }
}