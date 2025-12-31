import { Entity, Instance, type QAngle, type Vector } from "cs_script/point_script";

export const utils = {
    printl(a: any) {Instance.Msg(a)},

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
    }
}