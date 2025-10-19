const SCRIPT_OWNER = "7ychu5";
const SCRIPT_TIME = "2025年10月18日11:12:35";
const SCRIPT_MAP = "ze_onliners_2025";
const SCRIPT_VERISON = "0.1";

import { BaseModelEntity, CSPlayerController, CSPlayerPawn, Entity, Instance, PointTemplate } from "cs_script/point_script";
import { utils } from "../utils";

// import { 
//     QueueThink, 
//     RunThinkQueue, 
//     Delay, 
// } from '../queneThink';

import { delay, tickCallback } from "../scheduleTick";

/*
v0.1:
    2025年10月18日11:12:35
*/
var players = new Array

class player {
    id:number = -1;
    controller:CSPlayerController|undefined = undefined;
    pawn:CSPlayerPawn|undefined = undefined;
    sname:string|undefined = ""
    tname:string|undefined = ""
    model:string = ""
    team:number|undefined = 0
    speed:number|undefined = 0;
    jump:boolean = false;
    crouch:boolean = false;
    alpha:number = 255;
    invisible:boolean = false;
    glowModel:BaseModelEntity|undefined = undefined;

    constructor(id: number){
        this.id = id
    }

    cCommand(command: string){Instance.ClientCommand(this.id, command)}
    updateController(){this.controller = Instance.GetPlayerController(this.id)}
    getController(){this.updateController();return this.controller}

    updatePawn(){this.pawn = this.getController()?.GetPlayerPawn()}
    getPawn(){this.updatePawn();return this.pawn}

    updateSname(){this.sname = this.getController()?.GetPlayerName()}
    getSname(){this.updateSname();return this.sname}

    updateTname(){this.tname = this.getPawn()?.GetEntityName()}
    getTname(){this.updateTname();return this.tname}
    setTname(params: string){this.tname = params;this.getPawn()?.SetEntityName(params)}

    

    updateTeam(){this.team = this.getController()?.GetTeamNumber()}
    getTeam(){this.updateTeam();return this.team}

    updateSpeed(){this.speed = utils.vectorDistance(
        this.getPawn()?.GetAbsVelocity().x as number,
        this.getPawn()?.GetAbsVelocity().y as number,
        this.getPawn()?.GetAbsVelocity().z as number
    )}
    getSpeed(){this.updateSpeed();return this.speed}

    updateJump(status: boolean){this.jump = status}
    getJump(){return this.jump}

    updateCrouch(){if(this.getPawn()?.IsCrouched()||this.getPawn()?.IsCrouching()) this.crouch = true; else this.crouch = false;}
    getCrouch(){this.updateCrouch();return this.crouch}

    updateAlpha(params: number){this.alpha = params}
    setAlpha(){utils.EntFireByHandle(this.getPawn(),"alpha",this.getAlpha().toString())}
    getAlpha(){return this.alpha}

    updateModel(params: string){this.model = params}
    setModel(){this.getPawn()?.SetModel(this.getModel())}
    getModel(){return this.model}

    updateGlow(model:BaseModelEntity){this.glowModel = model}
    async setGlowModel(){
        setPlayerGlow(this.id, false)
        await(0.1)
        setPlayerGlow(this.id, false)
    }
    getGlowModel(){return this.glowModel}
}

Instance.OnPlayerReset(({}) => {
    let j = -1
    while(j <= 64){
        j++;
        if(!Instance.GetPlayerController(j)) continue;
        players[j] = new player(j)
        players[j].setTname("player#" + j.toString())
        switch (players[j].getTeam()) {
            case 2:players[j].updateModel("characters/models/tm_phoenix/tm_phoenix.vmdl");break;
            case 3:players[j].updateModel("characters/models/ctm_sas/ctm_sas.vmdl");break;
            default:break;
        }
    }
});

Instance.OnScriptInput("_setPlayerGlow", () => {setPlayerGlow(0,false)});

async function setPlayerGlow(playerId:number, status:boolean) {
    utils.printl("setPlayerGlow0"+playerId);
    let glowModel = players[playerId].getGlowModel()
    if(glowModel == undefined&&status){
        utils.EntFireByHandle(glowModel,"kill")
        return;
    }
    if(glowModel != undefined) utils.EntFireByHandle(glowModel,"kill")
    utils.printl("setPlayerGlow1"+playerId);
    let template = Instance.FindEntityByName("template_placeholder") as PointTemplate
    let spawned = template.ForceSpawn()
    if(spawned !== undefined && spawned[0] !== undefined){
        (spawned[0] as BaseModelEntity).SetModel(players[playerId].getModel());
        (spawned[0] as BaseModelEntity).Glow();
        utils.EntFireByHandle(spawned[0], "FollowEntity", players[playerId].getTname())
        utils.EntFireByHandle(spawned[0], "alpha", "1")
        players[playerId].updateGlow(spawned[0])
    }

    await delay(0.05)
    setPlayerGlow(playerId,false)
}

Instance.OnScriptReload({
    after: () => {},
});

Instance.SetThink(() => {
    tickCallback();
    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 128);
});
Instance.SetNextThink(Instance.GetGameTime())

Instance.OnPlayerJump(async () => {
    utils.printl(Instance.GetGameTime() + " player jump 0");
    await delay(1);
    utils.printl(Instance.GetGameTime() + " player jump 1 (1秒后)");
    await delay(2);
    utils.printl(Instance.GetGameTime() + " player jump 2 (3秒后)");
    await delay(3);
    utils.printl(Instance.GetGameTime() + " player jump 3 (6秒后)");
});