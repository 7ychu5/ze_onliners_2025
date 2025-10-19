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
    vectorDistance(x, y, z) {
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2));
    }
};

const onTicks = [];
let delayActions = [];
function tickCallback() {
    for (const cb of onTicks) {
        cb();
    }
    delayActions = delayActions.filter(act => {
        if (act.targetTime > Instance.GetGameTime())
            return true;
        act.resolve();
        return false;
    });
}
function delay(seconds) {
    const targetTime = Instance.GetGameTime() + seconds;
    return new Promise((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var players = new Array;
class player {
    constructor(id) {
        this.id = -1;
        this.controller = undefined;
        this.pawn = undefined;
        this.sname = "";
        this.tname = "";
        this.model = "";
        this.team = 0;
        this.speed = 0;
        this.jump = false;
        this.crouch = false;
        this.alpha = 255;
        this.invisible = false;
        this.glowModel = undefined;
        this.id = id;
    }
    cCommand(command) { Instance.ClientCommand(this.id, command); }
    updateController() { this.controller = Instance.GetPlayerController(this.id); }
    getController() { this.updateController(); return this.controller; }
    updatePawn() { var _a; this.pawn = (_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetPlayerPawn(); }
    getPawn() { this.updatePawn(); return this.pawn; }
    updateSname() { var _a; this.sname = (_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetPlayerName(); }
    getSname() { this.updateSname(); return this.sname; }
    updateTname() { var _a; this.tname = (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetEntityName(); }
    getTname() { this.updateTname(); return this.tname; }
    setTname(params) { var _a; this.tname = params; (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.SetEntityName(params); }
    updateTeam() { var _a; this.team = (_a = this.getController()) === null || _a === void 0 ? void 0 : _a.GetTeamNumber(); }
    getTeam() { this.updateTeam(); return this.team; }
    updateSpeed() {
        var _a, _b, _c;
        this.speed = utils.vectorDistance((_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.GetAbsVelocity().x, (_b = this.getPawn()) === null || _b === void 0 ? void 0 : _b.GetAbsVelocity().y, (_c = this.getPawn()) === null || _c === void 0 ? void 0 : _c.GetAbsVelocity().z);
    }
    getSpeed() { this.updateSpeed(); return this.speed; }
    updateJump(status) { this.jump = status; }
    getJump() { return this.jump; }
    updateCrouch() { var _a, _b; if (((_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.IsCrouched()) || ((_b = this.getPawn()) === null || _b === void 0 ? void 0 : _b.IsCrouching()))
        this.crouch = true;
    else
        this.crouch = false; }
    getCrouch() { this.updateCrouch(); return this.crouch; }
    updateAlpha(params) { this.alpha = params; }
    setAlpha() { utils.EntFireByHandle(this.getPawn(), "alpha", this.getAlpha().toString()); }
    getAlpha() { return this.alpha; }
    updateModel(params) { this.model = params; }
    setModel() { var _a; (_a = this.getPawn()) === null || _a === void 0 ? void 0 : _a.SetModel(this.getModel()); }
    getModel() { return this.model; }
    updateGlow(model) { this.glowModel = model; }
    setGlowModel() {
        return __awaiter(this, void 0, void 0, function* () {
            setPlayerGlow(this.id);
            yield (0.1);
            setPlayerGlow(this.id);
        });
    }
    getGlowModel() { return this.glowModel; }
}
Instance.OnPlayerReset(({}) => {
    let j = -1;
    while (j <= 64) {
        j++;
        if (!Instance.GetPlayerController(j))
            continue;
        players[j] = new player(j);
        players[j].setTname("player#" + j.toString());
        switch (players[j].getTeam()) {
            case 2:
                players[j].updateModel("characters/models/tm_phoenix/tm_phoenix.vmdl");
                break;
            case 3:
                players[j].updateModel("characters/models/ctm_sas/ctm_sas.vmdl");
                break;
        }
    }
});
Instance.OnScriptInput("_setPlayerGlow", () => { setPlayerGlow(0); });
function setPlayerGlow(playerId, status) {
    return __awaiter(this, void 0, void 0, function* () {
        utils.printl("setPlayerGlow0" + playerId);
        let glowModel = players[playerId].getGlowModel();
        if (glowModel != undefined)
            utils.EntFireByHandle(glowModel, "kill");
        utils.printl("setPlayerGlow1" + playerId);
        let template = Instance.FindEntityByName("template_placeholder");
        let spawned = template.ForceSpawn();
        if (spawned !== undefined && spawned[0] !== undefined) {
            spawned[0].SetModel(players[playerId].getModel());
            spawned[0].Glow();
            utils.EntFireByHandle(spawned[0], "FollowEntity", players[playerId].getTname());
            utils.EntFireByHandle(spawned[0], "alpha", "1");
            players[playerId].updateGlow(spawned[0]);
        }
        yield delay(0.05);
        setPlayerGlow(playerId);
    });
}
Instance.OnScriptReload({
    after: () => { },
});
Instance.SetThink(() => {
    tickCallback();
    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 128);
});
Instance.SetNextThink(Instance.GetGameTime());
Instance.OnPlayerJump(() => __awaiter(void 0, void 0, void 0, function* () {
    utils.printl(Instance.GetGameTime() + " player jump 0");
    yield delay(1);
    utils.printl(Instance.GetGameTime() + " player jump 1 (1秒后)");
    yield delay(2);
    utils.printl(Instance.GetGameTime() + " player jump 2 (3秒后)");
    yield delay(3);
    utils.printl(Instance.GetGameTime() + " player jump 3 (6秒后)");
}));
