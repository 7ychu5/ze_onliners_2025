const SCRIPT_OWNER = "7ychu5";
const SCRIPT_TIME = "2025年10月18日11:12:35";
const SCRIPT_MAP = "ze_onliners_2025";
const SCRIPT_VERISON = "0.1";

import { BaseModelEntity, CSPlayerController, CSPlayerPawn, Entity, Instance, PointTemplate, type QAngle, type Vector } from "cs_script/point_script";
import { utils } from "../utils";
import { delay, tickCallback } from "../scheduleTick";

import { AbilityManager, type IAbility } from "../abilities/abilitiesSystem";
import { GrappleAbility } from "../abilities/grapple";
import { DoubleJumpAbility } from "../abilities/doubleJump";
import { ClimbingAbility } from "../abilities/climbing";
import { DashAbility } from "../abilities/dash";
import { LifeStealBulletAbility } from "../abilities/lifeSteal";
import { ExplosiveBulletAbility } from "../abilities/bulletExplode";
import { RicochetBulletAbility } from "../abilities/bulletRicochet";
import { StealMarkAbility } from "../abilities/stealPing";
import { CriticalStrikeAbility } from "../abilities/critical";
import { PayToWinAbility } from "../abilities/payToWin";
import { ReloadDamageBoostAbility } from "../abilities/reloadDamageBoost";
import { VelocityDamageBoostAbility } from "../abilities/velocityDamageBoost";
import { DrawDamageBoostAbility } from "../abilities/drawDamageBoost";
import { BerserkDamageBoostAbility } from "../abilities/berserkDamageBoost";

import { FlipGame } from "../puzzles/flipGame"

let flipGame: FlipGame;
flipGame = new FlipGame();
flipGame.startGame();

export class Player {
    // 基础属性
    public id: number;
    public controller: CSPlayerController | undefined;
    public pawn: CSPlayerPawn | undefined;
    public sname: string;
    public tname: string;
    public model: string;
    public team: number;
    public speed: number;
    public jump: boolean;
    public crouch: boolean;
    public hp: number;
    public hpmax: number
    public alpha: number;
    public invisible: boolean;
    public glowModel: BaseModelEntity | undefined;
    public particle01: Entity | undefined;
    public text: Entity | undefined;
    public text_content: string
    public lastUsedWeapon: string
    public currentWeapon: string

    // 能力系统
    private abilityManager: AbilityManager;

    constructor(id: number) {
        this.id = id;
        this.controller = undefined;
        this.pawn = undefined;
        this.sname = "";
        this.tname = "";
        this.model = "";
        this.team = 0;
        this.speed = 0;
        this.jump = false;
        this.crouch = false;
        this.hp = 100;
        this.hpmax = 100;
        this.alpha = 255;
        this.invisible = false;
        this.glowModel = undefined;
        this.particle01 = undefined;
        this.text = undefined;
        this.text_content = "";
        this.lastUsedWeapon = "";
        this.currentWeapon = "";


        this.abilityManager = new AbilityManager(id);
        this.initializeAbilities();
    }

    // 能力系统初始化
    private initializeAbilities(): void {

    }

    registerDamageAbility(ability: IAbility): void {
        // 能力会在自己的initialize方法中注册到伤害修改系统
        this.abilityManager.registerAbility(ability);
    }

    // 能力系统代理方法
    updateAbilities(): void {
        this.abilityManager.updateAll();
    }

    getAbility(abilityName: string): IAbility | undefined {
        return this.abilityManager.getAbility(abilityName);
    }

    registerAbility(ability: IAbility): void {
        this.abilityManager.registerAbility(ability);
    }

    unregisterAbility(abilityName: string): void {
        this.abilityManager.unregisterAbility(abilityName);
    }

    getAbilityNames(): string[] {
        return this.abilityManager.getAbilityNames();
    }

    // 玩家重置处理
    onPlayerReset(): void {
        this.abilityManager.onPlayerReset();
        this.setTname("player#" + this.id.toString());
        this.setText();

        if(this.getParticle01() == undefined) this.updateParticle01(Instance.FindEntityByName(this.getTname() + "_particle01"));
        this.useParticle01("stop");

        // 设置默认模型
        switch (this.getTeam()) {
            case 2:this.updateModel("characters/models/tm_phoenix/tm_phoenix.vmdl");break;
            case 3:this.updateModel("characters/models/ctm_sas/ctm_sas.vmdl");break;
            default:break;
        }
    }

    // 玩家断开处理
    onPlayerDisconnect(): void {
        this.abilityManager.onPlayerDisconnect();
    }

    onPlayerDeath(): void {
        this.useParticle01("start")
    }

    // 原有基础方法
    cCommand(command: string): void {
        Instance.ClientCommand(this.id, command);
    }

    updateController(): void {
        this.controller = Instance.GetPlayerController(this.id);
    }

    getController(): CSPlayerController | undefined {
        this.updateController();
        return this.controller;
    }

    updatePawn(): void {
        this.pawn = this.getController()?.GetPlayerPawn();
    }

    getPawn(): CSPlayerPawn | undefined {
        this.updatePawn();
        return this.pawn;
    }

    updateSname(): void {
        this.sname = this.getController()?.GetPlayerName() || "";
    }

    getSname(): string {
        this.updateSname();
        return this.sname;
    }

    updateTname(): void {
        this.tname = this.getPawn()?.GetEntityName() || "";
    }

    getTname(): string {
        this.updateTname();
        return this.tname;
    }

    setTname(params: string): void {
        this.tname = params;
        const pawn = this.getPawn();
        if (pawn) pawn.SetEntityName(params);
    }

    updateTeam(): void {
        this.team = this.getController()?.GetTeamNumber() || 0;
    }

    getTeam(): number {
        this.updateTeam();
        return this.team;
    }

    updateSpeed(): void {
        const velocity = this.getPawn()?.GetAbsVelocity();
        if (velocity) {
            this.speed = utils.vectorDistance(velocity);
        } else {
            this.speed = 0;
        }
    }

    getSpeed(): number {
        this.updateSpeed();
        return this.speed;
    }

    updateJump(status: boolean): void {
        this.jump = status;
    }

    getJump(): boolean {
        return this.jump;
    }

    updateCrouch(): void {
        const pawn = this.getPawn();
        this.crouch = !!(pawn?.IsCrouched() || pawn?.IsCrouching());
    }

    getCrouch(): boolean {
        this.updateCrouch();
        return this.crouch;
    }

    updateHP() {
        this.hp = this.getPawn()?.GetHealth() as number
    }

    setHP(health: number) {
        this.getPawn()?.SetHealth(health)
        this.updateHP()
    }

    getHP(): number {
        this.updateHP()
        return this.hp
    }

    updateHPMAX() {
        this.hpmax = this.getPawn()?.GetMaxHealth() as number
    }

    setHPMAX(healthmax: number) {
        this.getPawn()?.SetMaxHealth(healthmax)
        this.updateHPMAX()
    }

    getHPMAX(): number {
        this.updateHPMAX()
        return this.hpmax
    }

    updateAlpha(params: number): void {
        this.alpha = params;
    }

    setAlpha(): void {
        const pawn = this.getPawn();
        if (pawn) utils.EntFireByHandle(pawn, "alpha", this.alpha.toString());
    }

    getAlpha(): number {
        return this.alpha;
    }

    updateModel(params: string): void {
        this.model = params;
    }

    setModel(): void {
        const pawn = this.getPawn();
        if (pawn) pawn.SetModel(this.model);
    }

    getModel(): string {
        return this.model;
    }

    updateGlow(model: BaseModelEntity): void {
        this.glowModel = model;
    }

    async setGlowModel(): Promise<void> {
        await setPlayerGlow(this.id, false);
        await delay(0.1);
        await setPlayerGlow(this.id, false);
    }

    getGlowModel(): BaseModelEntity | undefined {
        return this.glowModel;
    }

    updateParticle01(entity: Entity | undefined): void {
        this.particle01 = entity
    }

    useParticle01(status: string): void {
        switch (status) {
            case "start":
                utils.EntFireByHandle(this.getParticle01(), "start")
                break;
            case "stop":
                utils.EntFireByHandle(this.getParticle01(), "stop")
                break;
            default:break;
        }
    }

    getParticle01(): Entity | undefined {
        return this.particle01
    }

    updateText(): void{
        let temptext1 = "当前技能：\n"
        let temptext2 = ""
        if(this.getAbilityNames() == undefined || this.getAbilityNames()[0] == "" || this.getAbilityNames().length == 0){
            temptext2 = "Empty"
        }
        else{
            // temptext2 = this.getAbilityNames().toString()
            this.getAbilityNames().forEach(element => {
                temptext2 = temptext2 + element + "\n"
            });
        }
        this.text_content = temptext1 + temptext2
        utils.EntFireByHandle(this.getText(), "SetMessage", this.text_content,0.00)
    }

    setText(): void{
        if(this.getText() !== undefined) return
        let template = Instance.FindEntityByName("template_worldtext") as PointTemplate
        let ent = template.ForceSpawn()
        ent ? this.text = ent[0] : this.text = undefined

        this.getText()?.SetEntityName("player_text#" + this.id)
        const eyePos = this.getPawn()?.GetEyePosition() as Vector;
        const eyeAngles = this.getPawn()?.GetEyeAngles() as QAngle;
        const leftAngles45 = {
            pitch: eyeAngles.pitch,
            yaw: eyeAngles.yaw + 45,
            roll: eyeAngles.roll
        };

        const leftDirection = utils.angleToVector(leftAngles45);

        // 计算脸部向前32个单位的位置
        const faceForwardPos = {
            x: eyePos.x + leftDirection.x * 12,
            y: eyePos.y + leftDirection.y * 12,
            z: eyePos.z + leftDirection.z * 12 + 4
        };
        this.getText()?.Teleport({position: faceForwardPos})
        utils.EntFireByHandle(this.getText(), "SetParent", this.getTname(),0.02)
    }

    getText(): Entity | undefined {
        if(Instance.FindEntityByName("player_text#" + this.id) !== undefined){
            this.text = Instance.FindEntityByName("player_text#" + this.id)
        }
        return this.text
    }

    updateCurrentWeapon(): void {
        const activeWeapon = this.getPawn()?.GetActiveWeapon();
        if (activeWeapon) {
            this.currentWeapon = activeWeapon.GetClassName();
        } else {
            this.currentWeapon = "";
        }
    }

    getCurrentWeapon(): string {
        this.updateCurrentWeapon();
        return this.currentWeapon;
    }

    updateLastUsedWeapon(): void {
        this.lastUsedWeapon = this.currentWeapon;
    }

    getLastUsedWeapon(): string {
        return this.lastUsedWeapon;
    }

    // 检查是否切换了武器
    hasSwitchedWeapon(): boolean {
        return this.lastUsedWeapon !== "" &&
               this.currentWeapon !== "" &&
               this.lastUsedWeapon !== this.currentWeapon;
    }

    // 工具方法
    isValid(): boolean {
        return !!this.getPawn()?.IsValid();
    }

    getPosition(): any | undefined {
        return this.getPawn()?.GetAbsOrigin();
    }

    getEyePosition(): any | undefined {
        return this.getPawn()?.GetEyePosition();
    }
}

// 全局玩家管理
export const players: Player[] = [];

// 玩家初始化
export function initializePlayerSystem(): void {
    for (let j = 0; j <= 64; j++) {
        if (!Instance.GetPlayerController(j)) continue;

        if (!players[j]) {
            players[j] = new Player(j);
        }

        const playerInstance = players[j];
        playerInstance?.onPlayerReset()
    }
}

Instance.OnPlayerReset(({ player }) => {
    let j = player.GetPlayerController()?.GetPlayerSlot() as number
    if (!Instance.GetPlayerController(j)) return

    if (!players[j]) {
        players[j] = new Player(j);
    }

    const playerInstance = players[j];

    // 调用玩家重置回调
    playerInstance?.onPlayerReset();
});

Instance.OnPlayerDisconnect((event) => {
    const playerSlot = event.playerSlot;
    if (players[playerSlot]) {
        players[playerSlot].onPlayerDisconnect();
    }
});

Instance.OnScriptInput("_setPlayerGlow", () => {setPlayerGlow(0,false)});

async function setPlayerGlow(playerId:number, status:boolean) {
    utils.printl("setPlayerGlow step0"+playerId);
    let glowModel = players[playerId]?.getGlowModel()
    if(glowModel == undefined&&status){
        utils.EntFireByHandle(glowModel,"kill")
        return;
    }
    if(glowModel != undefined) utils.EntFireByHandle(glowModel,"kill")
    utils.printl("setPlayerGlow step1"+playerId);
    let template = Instance.FindEntityByName("template_prop_nosolid_placeholder") as PointTemplate
    let spawned = template.ForceSpawn()
    if(spawned !== undefined && spawned[0] !== undefined){
        (spawned[0] as BaseModelEntity).SetModel(players[playerId]?.getModel() as string);
        (spawned[0] as BaseModelEntity).Glow();
        utils.EntFireByHandle(spawned[0], "FollowEntity", players[playerId]?.getTname())
        utils.EntFireByHandle(spawned[0], "alpha", "1")
        players[playerId]?.updateGlow(spawned[0] as BaseModelEntity)
    }

    await delay(0.05)
    setPlayerGlow(playerId,false)
}

Instance.OnScriptInput("givePlayerAbility_grapple", (ctx) => {givePlayerAbility(ctx,"grapple")});
Instance.OnScriptInput("givePlayerAbility_doubleJump", (ctx) => {givePlayerAbility(ctx,"doubleJump")});
Instance.OnScriptInput("givePlayerAbility_climbing", (ctx) => {givePlayerAbility(ctx,"climbing")});
Instance.OnScriptInput("givePlayerAbility_dash", (ctx) => {givePlayerAbility(ctx,"dash")});

Instance.OnScriptInput("givePlayerAbility_lifeSteal", (ctx) => {givePlayerAbility(ctx,"lifeSteal")});
Instance.OnScriptInput("givePlayerAbility_bulletExplode", (ctx) => {givePlayerAbility(ctx,"bulletExplode")});
Instance.OnScriptInput("givePlayerAbility_bulletRicochet", (ctx) => {givePlayerAbility(ctx,"bulletRicochet")});
Instance.OnScriptInput("givePlayerAbility_stealPing", (ctx) => {givePlayerAbility(ctx,"stealPing")});
Instance.OnScriptInput("givePlayerAbility_critical", (ctx) => {givePlayerAbility(ctx,"critical")});
Instance.OnScriptInput("givePlayerAbility_payToWin", (ctx) => {givePlayerAbility(ctx,"paytowin")});
Instance.OnScriptInput("givePlayerAbility_reloadDamageBoost", (ctx) => {givePlayerAbility(ctx,"reloadDamageBoost")});
Instance.OnScriptInput("givePlayerAbility_velocityDamageBoost", (ctx) => {givePlayerAbility(ctx,"velocityDamageBoost")});
Instance.OnScriptInput("givePlayerAbility_drawDamageBoost", (ctx) => {givePlayerAbility(ctx,"drawDamageBoost")});
Instance.OnScriptInput("givePlayerAbility_berserkDamageBoost", (ctx) => { givePlayerAbility(ctx, "berserkDamageBoost"); });

function givePlayerAbility(ctx: any, params: string) {
    let playerId = ctx.activator.GetPlayerController().GetPlayerSlot()
    switch (params) {
        case "grapple":
            const grappleAbility = new GrappleAbility(
                playerId,
                () => players[playerId]?.getPawn(),
                () => players[playerId]?.getCrouch() as boolean
            );
            players[playerId]?.registerAbility(grappleAbility);
            break;
        case "doubleJump":
            const doubleJumpAbility = new DoubleJumpAbility(
                playerId,
                () => players[playerId]?.getPawn(),
                () => players[playerId]?.getCrouch() as boolean
            );
            players[playerId]?.registerAbility(doubleJumpAbility);
            break;
        case "climbing":
            const climbingAbility = new ClimbingAbility(
                playerId,
                () => players[playerId]?.getPawn(),
            );
            players[playerId]?.registerAbility(climbingAbility);
            break;
        case "dash":
            const dashAbility = new DashAbility(
                playerId,
                () => players[playerId]?.getPawn(),
                () => players[playerId]?.getCrouch() as boolean
            );
            players[playerId]?.registerAbility(dashAbility);
            break;
        case "lifeSteal":
            const lifeStealBulletAbility = new LifeStealBulletAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerAbility(lifeStealBulletAbility);
            break;
        case "bulletExplode":
            const explosiveBulletAbility = new ExplosiveBulletAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerAbility(explosiveBulletAbility);
            break;
        case "bulletRicochet":
            const ricochetBulletAbility = new RicochetBulletAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerAbility(ricochetBulletAbility);
            break;
        case "stealPing":
            const stealMarkAbility = new StealMarkAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerAbility(stealMarkAbility);
            break;
        case "critical":
            const criticalStrikeAbility = new CriticalStrikeAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(criticalStrikeAbility);
            break;
        case "paytowin":
            const payToWinAbility = new PayToWinAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(payToWinAbility);
            break;
        case "reloadDamageBoost":
            const reloadDamageBoostAbility = new ReloadDamageBoostAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(reloadDamageBoostAbility);
            break;
        case "velocityDamageBoost":
            const velocityDamageBoostAbility = new VelocityDamageBoostAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(velocityDamageBoostAbility);
            break;
        case "drawDamageBoost":
            const drawDamageBoostAbility = new DrawDamageBoostAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(drawDamageBoostAbility);
            break;
        case "berserkDamageBoost":
            const berserkDamageBoostAbility = new BerserkDamageBoostAbility(
                playerId,
                () => players[playerId]
            );
            players[playerId]?.registerDamageAbility(berserkDamageBoostAbility);
            break;

        default:utils.printl("Unexcepted Ability");break;
    }
}



// 全局更新循环
Instance.SetThink(() => {
    tickCallback();

    // 更新所有玩家的能力系统//
    for (const player of players) {
        if (player && player.isValid()) {
            player.updateAbilities();
            if (player.getPawn() && player.getPawn()?.IsValid() && player.getText() !== undefined) player.updateText();
        }
    }

    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 128);
});
Instance.SetNextThink(Instance.GetGameTime());

Instance.OnScriptReload({
    after: () => {
        utils.printl("manager重载")
        initializePlayerSystem();
    },
});

Instance.OnRoundStart(() => {
    players.length = 0
    initializePlayerSystem();
});

Instance.OnPlayerKill(( event ) => {
    let playerId = event.player.GetPlayerController()?.GetPlayerSlot()
    if(!playerId) return
    players[playerId]?.onPlayerDeath()
});