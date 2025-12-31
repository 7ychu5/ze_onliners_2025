// s2ts v0.6.1
import { Instance, BaseModelEntity } from 'cs_script/point_script';

function delay(seconds) {
    Instance.GetGameTime() + seconds;
    return new Promise((resolve) => {
    });
}

const WorldOrigin = { x: 0, y: 0, z: 0 };
const C = {
    WorldOrigin
};

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

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const cellModel = "models/7ychu5/public/box.vmdl";
class FlipGame {
    constructor(config) {
        this.grid = [];
        this.fixedCells = [];
        this.cells = [];
        this.gameActive = false;
        this.connections = [];
        this.isCompleted = false;
        this.config = {
            gridSize: 3,
            fixedCellProbability: 0.1,
            spacing: 32
        };
        this.difficultySettings = {
            easy: { gridSize: 3, fixedCellProbability: 0.1 },
            medium: { gridSize: 5, fixedCellProbability: 0.2 },
            hard: { gridSize: 7, fixedCellProbability: 0.3 }
        };
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
        this.connections = [];
        this.startPosition = C.WorldOrigin;
        this.instanceId = (config === null || config === void 0 ? void 0 : config.instanceId) || `flip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.cellTemplate = Instance.FindEntityByName("template_prop_solid_placeholder");
        if (config) {
            this.applyConfig(config);
        }
        this.initializeGame();
        if ((config === null || config === void 0 ? void 0 : config.autoStart) !== false) {
            this.startGame();
        }
    }
    applyConfig(config) {
        if (config.difficulty && this.difficultySettings[config.difficulty]) {
            const difficultyConfig = this.difficultySettings[config.difficulty];
            this.config.gridSize = difficultyConfig.gridSize;
            this.config.fixedCellProbability = difficultyConfig.fixedCellProbability;
        }
        if (config.gridSize !== undefined) {
            this.config.gridSize = config.gridSize;
        }
        if (config.startPosition !== undefined) {
            this.startPosition = config.startPosition;
        }
        else if (config.startEntityName) {
            this.setStartEntity(config.startEntityName);
        }
        if (config.fixedCellProbability !== undefined) {
            this.config.fixedCellProbability = config.fixedCellProbability;
        }
        if (config.spacing !== undefined) {
            this.config.spacing = config.spacing;
        }
    }
    initializeGame() {
        if (this.startPosition === C.WorldOrigin) {
            const startEntity = Instance.FindEntityByName("puzzle_flipGame_loc_1");
            if (startEntity) {
                this.startPosition = startEntity.GetAbsOrigin();
            }
        }
        if (!this.cellTemplate) {
            utils.printl(`[${this.instanceId}] 错误：未找到格子模板 template_prop_solid_placeholder`);
            return;
        }
        this.setupEventListeners();
    }
    setupEventListeners() {
        Instance.OnScriptInput(`flip_reset_${this.instanceId}`, () => {
            this.resetGame();
        });
        Instance.OnScriptInput(`flip_stop_${this.instanceId}`, () => {
            this.stopGame();
        });
    }
    createSolvablePuzzle() {
        for (let i = 0; i < this.config.gridSize; i++) {
            this.grid[i] = [];
            this.fixedCells[i] = [];
            for (let j = 0; j < this.config.gridSize; j++) {
                this.grid[i][j] = false;
                this.fixedCells[i][j] = Math.random() < this.config.fixedCellProbability;
            }
        }
        const operations = Math.floor(this.config.gridSize * this.config.gridSize * 0.4);
        for (let k = 0; k < operations; k++) {
            const i = Math.floor(Math.random() * this.config.gridSize);
            const j = Math.floor(Math.random() * this.config.gridSize);
            this.simulateFlip(i, j);
        }
    }
    simulateFlip(row, col) {
        const positions = [
            { r: row, c: col },
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ];
        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r][pos.c]) {
                    this.grid[pos.r][pos.c] = !this.grid[pos.r][pos.c];
                }
            }
        });
    }
    createGrid() {
        var _a;
        const baseAngle = { pitch: 0, yaw: 0, roll: 0 };
        this.destroyGrid();
        this.createSolvablePuzzle();
        for (let i = 0; i < this.config.gridSize; i++) {
            this.cells[i] = [];
            for (let j = 0; j < this.config.gridSize; j++) {
                const position = {
                    x: this.startPosition.x + i * this.config.spacing,
                    y: this.startPosition.y,
                    z: this.startPosition.z + j * this.config.spacing
                };
                const spawned = (_a = this.cellTemplate) === null || _a === void 0 ? void 0 : _a.ForceSpawn(position, baseAngle);
                if (spawned && spawned.length > 0) {
                    const cell = spawned[0];
                    const cellName = `flip_cell_${this.instanceId}_${i}_${j}`;
                    if (!cell || !(cell instanceof BaseModelEntity))
                        continue;
                    cell === null || cell === void 0 ? void 0 : cell.SetModel(cellModel);
                    cell === null || cell === void 0 ? void 0 : cell.SetEntityName(cellName);
                    this.cells[i][j] = cell;
                    const connId = Instance.ConnectOutput(cell, "OnHealthChanged", () => {
                        if (this.gameActive && !this.isCompleted) {
                            this.onCellClicked(i, j);
                        }
                    });
                    if (connId) {
                        this.connections.push(connId);
                    }
                    this.updateCellAppearance(i, j);
                }
            }
        }
    }
    onCellClicked(row, col) {
        if (!this.gameActive || this.isCompleted)
            return;
        utils.printl(`[${this.instanceId}] 格子被点击: ${row}, ${col}`);
        if (Instance.FindEntityByName("flip_game_sound_click")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_click",
                input: "PlaySound"
            });
        }
        this.flipCell(row, col);
        this.checkWinCondition();
    }
    flipCell(row, col) {
        const positions = [
            { r: row, c: col },
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ];
        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r][pos.c]) {
                    this.grid[pos.r][pos.c] = !this.grid[pos.r][pos.c];
                    this.updateCellAppearance(pos.r, pos.c);
                }
            }
        });
    }
    updateCellAppearance(row, col) {
        if (!this.cells[row] || !this.cells[row][col])
            return;
        const cell = this.cells[row][col];
        if (!(cell === null || cell === void 0 ? void 0 : cell.IsValid()))
            return;
        const isOn = this.grid[row][col];
        const isFixed = this.fixedCells[row][col];
        if (cell instanceof BaseModelEntity) {
            let color;
            if (isFixed) {
                color = { r: 150, g: 150, b: 150, a: 255 };
            }
            else {
                color = isOn ?
                    { r: 255, g: 100, b: 100, a: 255 } :
                    { r: 100, g: 100, b: 255, a: 255 };
            }
            cell.SetColor(color);
            if (!isFixed) {
                if (isOn) {
                    cell.Glow({ r: 255, g: 50, b: 50, a: 128 });
                }
                else {
                    cell.Unglow();
                }
            }
            else {
                cell.Unglow();
            }
            cell.SetModelScale(isFixed ? 0.9 : (isOn ? 1.0 : 0.8));
        }
    }
    checkWinCondition() {
        const firstState = this.grid[0][0];
        let allSame = true;
        for (let i = 0; i < this.config.gridSize && allSame; i++) {
            for (let j = 0; j < this.config.gridSize && allSame; j++) {
                if (!this.fixedCells[i][j] && this.grid[i][j] !== firstState) {
                    allSame = false;
                }
            }
        }
        if (allSame) {
            this.gameWin();
        }
    }
    gameWin() {
        return __awaiter(this, void 0, void 0, function* () {
            this.gameActive = false;
            this.isCompleted = true;
            utils.printl(`[${this.instanceId}] 游戏胜利！所有格子颜色统一！`);
            for (let i = 0; i < this.config.gridSize; i++) {
                for (let j = 0; j < this.config.gridSize; j++) {
                    if (!this.cells[i] || !this.cells[i][j])
                        continue;
                    const cell = this.cells[i][j];
                    if (cell instanceof BaseModelEntity) {
                        cell.SetColor({ r: 0, g: 255, b: 0, a: 255 });
                        if (!this.fixedCells[i][j]) {
                            cell.Unglow();
                        }
                    }
                }
            }
            this.triggerCompletionEvent();
            yield delay(3);
            this.stopGame();
        });
    }
    triggerCompletionEvent() {
        Instance.EntFireAtName({
            name: "flip_game_complete",
            input: "OnComplete",
            value: this.instanceId
        });
    }
    destroyGrid() {
        var _a;
        this.connections.forEach(connId => {
            Instance.DisconnectOutput(connId);
        });
        this.connections = [];
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i]) {
                for (let j = 0; j < ((_a = this.cells[i]) === null || _a === void 0 ? void 0 : _a.length); j++) {
                    const cell = this.cells[i][j];
                    if (cell === null || cell === void 0 ? void 0 : cell.IsValid()) {
                        cell.Remove();
                    }
                }
            }
        }
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
    }
    startGame() {
        if (this.gameActive) {
            this.stopGame();
        }
        this.gameActive = true;
        this.isCompleted = false;
        this.createGrid();
        utils.printl(`[${this.instanceId}] Flip Game 开始！网格大小: ${this.config.gridSize}x${this.config.gridSize}`);
        this.showGameInfo();
        if (Instance.FindEntityByName("flip_game_sound_start")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_start",
                input: "PlaySound"
            });
        }
    }
    showGameInfo() {
        Instance.DebugScreenText({
            text: `Flip Game ${this.config.gridSize}x${this.config.gridSize}\n射击格子翻转颜色\n目标是让所有非灰色格子变成相同颜色`,
            x: 0.5, y: 0.1, duration: 5,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
        let fixedCount = 0;
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                if (this.fixedCells[i][j])
                    fixedCount++;
            }
        }
        if (fixedCount > 0) {
            utils.printl(`[${this.instanceId}] 固定格子数量: ${fixedCount}`);
        }
    }
    resetGame() {
        if (!this.gameActive)
            return;
        utils.printl(`[${this.instanceId}] Flip Game 重置`);
        Instance.DebugScreenText({
            text: "游戏已重置",
            x: 0.5, y: 0.9, duration: 2,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });
        this.createGrid();
    }
    stopGame() {
        this.gameActive = false;
        this.destroyGrid();
        utils.printl(`[${this.instanceId}] Flip Game 停止`);
    }
    setStartPosition(position) {
        this.startPosition = position;
        utils.printl(`[${this.instanceId}] 起始位置已设置: (${position.x}, ${position.y}, ${position.z})`);
    }
    setStartEntity(entityName) {
        const entity = Instance.FindEntityByName(entityName);
        if (entity) {
            this.startPosition = entity.GetAbsOrigin();
            utils.printl(`[${this.instanceId}] 起始位置已从实体 ${entityName} 设置`);
        }
        else {
            utils.printl(`[${this.instanceId}] 错误：未找到实体 ${entityName}`);
        }
    }
    getGameState() {
        return {
            active: this.gameActive,
            completed: this.isCompleted,
            gridSize: this.config.gridSize,
            instanceId: this.instanceId
        };
    }
    getInstanceId() {
        return this.instanceId;
    }
    isGameCompleted() {
        return this.isCompleted;
    }
    isGameActive() {
        return this.gameActive;
    }
    getConfig() {
        return {
            gridSize: this.config.gridSize,
            fixedCellProbability: this.config.fixedCellProbability,
            spacing: this.config.spacing,
            instanceId: this.instanceId
        };
    }
}

export { FlipGame };
