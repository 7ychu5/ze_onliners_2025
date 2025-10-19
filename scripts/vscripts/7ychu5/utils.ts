import { Entity, Instance, type Vector } from "cs_script/point_script";

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

    vectorDistance(x: number, y: number,z: number) {
        return Math.sqrt(Math.pow(x,2)+Math.pow(y,2)+Math.pow(z,2))
    }
}