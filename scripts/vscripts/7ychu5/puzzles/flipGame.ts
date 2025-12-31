import { Instance, BaseModelEntity, PointTemplate, Entity, type Vector, type QAngle, type Color } from "cs_script/point_script";
import { delay } from "../scheduleTick";
import { C } from "../constants";
import { utils } from "../utils";

const cellModel = "models/7ychu5/public/box.vmdl"

// 游戏配置接口
export interface FlipGameConfig {
    gridSize?: number;
    startPosition?: Vector;
    startEntityName?: string;
    instanceId?: string;
    fixedCellProbability?: number;
    spacing?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    autoStart?: boolean;
}

export class FlipGame {
    private grid: boolean[][] = [];
    private fixedCells: boolean[][] = [];
    private cells: Entity[][] = [];
    private gameActive = false;
    private startPosition: Vector;
    private cellTemplate: PointTemplate | undefined;
    private connections: number[] = [];
    private instanceId: string;
    private isCompleted = false;

    private config = {
        gridSize: 3, // 现在 gridSize 在 config 对象中
        fixedCellProbability: 0.1,
        spacing: 32
    };

    // 难度配置
    private difficultySettings = {
        easy: { gridSize: 3, fixedCellProbability: 0.1 },
        medium: { gridSize: 5, fixedCellProbability: 0.2 },
        hard: { gridSize: 7, fixedCellProbability: 0.3 }
    };

    constructor(config?: FlipGameConfig) {
        // 初始化数组
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
        this.connections = [];
        this.startPosition = C.WorldOrigin;

        // 生成唯一实例ID
        this.instanceId = config?.instanceId || `flip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        // 查找模板实体
        this.cellTemplate = Instance.FindEntityByName("template_prop_solid_placeholder") as PointTemplate;

        // 应用配置
        if (config) {
            this.applyConfig(config);
        }

        // 初始化游戏
        this.initializeGame();

        // 如果配置了自动开始，则立即开始游戏
        if (config?.autoStart !== false) {
            this.startGame();
        }
    }

    // 应用配置
    private applyConfig(config: FlipGameConfig): void {
        // 处理难度预设
        if (config.difficulty && this.difficultySettings[config.difficulty]) {
            const difficultyConfig = this.difficultySettings[config.difficulty];
            this.config.gridSize = difficultyConfig.gridSize;
            this.config.fixedCellProbability = difficultyConfig.fixedCellProbability;
        }

        // gridSize 直接来自配置，优先于难度预设
        if (config.gridSize !== undefined) {
            this.config.gridSize = config.gridSize;
        }

        if (config.startPosition !== undefined) {
            this.startPosition = config.startPosition;
        } else if (config.startEntityName) {
            this.setStartEntity(config.startEntityName);
        }

        if (config.fixedCellProbability !== undefined) {
            this.config.fixedCellProbability = config.fixedCellProbability;
        }

        if (config.spacing !== undefined) {
            this.config.spacing = config.spacing;
        }
    }

    private initializeGame(): void {
        // 确保有起始位置
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

    private setupEventListeners(): void {
        // 使用实例特定的输入名称来避免冲突
        Instance.OnScriptInput(`flip_reset_${this.instanceId}`, () => {
            this.resetGame();
        });

        Instance.OnScriptInput(`flip_stop_${this.instanceId}`, () => {
            this.stopGame();
        });

    }

    /**
     * 创建可解谜题
     */
    private createSolvablePuzzle(): void {
        // 重置网格
        for (let i = 0; i < this.config.gridSize; i++) {
            this.grid[i] = [];
            this.fixedCells[i] = [];
            for (let j = 0; j < this.config.gridSize; j++) {
                this.grid[i]![j] = false;
                this.fixedCells[i]![j] = Math.random() < this.config.fixedCellProbability;
            }
        }

        // 生成可解谜题：从解决状态开始，随机反向操作
        const operations = Math.floor(this.config.gridSize * this.config.gridSize * 0.4);
        for (let k = 0; k < operations; k++) {
            const i = Math.floor(Math.random() * this.config.gridSize);
            const j = Math.floor(Math.random() * this.config.gridSize);
            this.simulateFlip(i, j);
        }
    }

    /**
     * 模拟翻转（用于生成谜题）
     */
    private simulateFlip(row: number, col: number): void {
        const positions = [
            { r: row, c: col },
            { r: row-1, c: col },
            { r: row+1, c: col },
            { r: row, c: col-1 },
            { r: row, c: col+1 }
        ];

        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r]![pos.c]) {
                    this.grid[pos.r]![pos.c] = !this.grid[pos.r]![pos.c];
                }
            }
        });
    }

    /**
     * 创建网格
     */
    private createGrid(): void {
        const baseAngle: QAngle = { pitch: 0, yaw: 0, roll: 0 };

        this.destroyGrid();
        this.createSolvablePuzzle();

        for (let i = 0; i < this.config.gridSize; i++) {
            this.cells[i] = [];

            for (let j = 0; j < this.config.gridSize; j++) {
                const position: Vector = {
                    x: this.startPosition.x + i * this.config.spacing,
                    y: this.startPosition.y,
                    z: this.startPosition.z + j * this.config.spacing
                };

                const spawned = this.cellTemplate?.ForceSpawn(position, baseAngle);
                if (spawned && spawned.length > 0) {
                    const cell = spawned[0];
                    // 使用实例特定的实体名称避免冲突
                    const cellName = `flip_cell_${this.instanceId}_${i}_${j}`;

                    if(!cell || !(cell instanceof BaseModelEntity)) continue;
                    cell?.SetModel(cellModel);
                    cell?.SetEntityName(cellName);
                    this.cells[i]![j] = cell;

                    // 连接输出，当格子受到伤害时触发
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

    /**
     * 处理格子点击
     */
    private onCellClicked(row: number, col: number): void {
        if (!this.gameActive || this.isCompleted) return;

        utils.printl(`[${this.instanceId}] 格子被点击: ${row}, ${col}`);

        // 播放点击音效（如果有）
        if (Instance.FindEntityByName("flip_game_sound_click")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_click",
                input: "PlaySound"
            });
        }

        this.flipCell(row, col);
        this.checkWinCondition();
    }

    /**
     * 翻转格子
     */
    private flipCell(row: number, col: number): void {
        const positions = [
            { r: row, c: col },
            { r: row-1, c: col },
            { r: row+1, c: col },
            { r: row, c: col-1 },
            { r: row, c: col+1 }
        ];

        positions.forEach(pos => {
            if (pos.r >= 0 && pos.r < this.config.gridSize && pos.c >= 0 && pos.c < this.config.gridSize) {
                if (!this.fixedCells[pos.r]![pos.c]) {
                    this.grid[pos.r]![pos.c] = !this.grid[pos.r]![pos.c];
                    this.updateCellAppearance(pos.r, pos.c);
                }
            }
        });
    }

    /**
     * 更新格子外观
     */
    private updateCellAppearance(row: number, col: number): void {
        if (!this.cells[row] || !this.cells[row][col]) return;

        const cell = this.cells[row][col];
        if (!cell?.IsValid()) return;

        const isOn = this.grid[row]![col];
        const isFixed = this.fixedCells[row]![col];

        if (cell instanceof BaseModelEntity) {
            let color: Color;

            if (isFixed) {
                color = { r: 150, g: 150, b: 150, a: 255 }; // 灰色 - 固定格子
            } else {
                color = isOn ?
                    { r: 255, g: 100, b: 100, a: 255 } : // 红色 - 开
                    { r: 100, g: 100, b: 255, a: 255 };  // 蓝色 - 关
            }

            cell.SetColor(color);

            if (!isFixed) {
                if (isOn) {
                    cell.Glow({ r: 255, g: 50, b: 50, a: 128 });
                } else {
                    cell.Unglow();
                }
            } else {
                cell.Unglow();
            }

            cell.SetModelScale(isFixed ? 0.9 : (isOn ? 1.0 : 0.8));
        }
    }

    /**
     * 检查胜利条件
     */
    private checkWinCondition(): void {
        const firstState = this.grid[0]![0];
        let allSame = true;

        // 只检查非固定格子
        for (let i = 0; i < this.config.gridSize && allSame; i++) {
            for (let j = 0; j < this.config.gridSize && allSame; j++) {
                if (!this.fixedCells[i]![j] && this.grid[i]![j] !== firstState) {
                    allSame = false;
                }
            }
        }

        if (allSame) {
            this.gameWin();
        }
    }

    /**
     * 游戏胜利
     */
    async gameWin() {
        this.gameActive = false;
        this.isCompleted = true;

        utils.printl(`[${this.instanceId}] 游戏胜利！所有格子颜色统一！`);


        // 胜利效果 - 所有格子变为绿色
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                if (!this.cells[i] || !this.cells[i]![j]) continue;

                const cell = this.cells[i]![j];
                if (cell instanceof BaseModelEntity) {
                    cell.SetColor({ r: 0, g: 255, b: 0, a: 255 });
                    if (!this.fixedCells[i]![j]) {
                        cell.Unglow();
                    }
                }
            }
        }

        // 触发完成事件（供外部监听）
        this.triggerCompletionEvent();

        await delay(3)
        //3秒后销毁本实例
        this.stopGame()
    }

    /**
     * 触发完成事件
     */
    private triggerCompletionEvent(): void {
        // 触发完成输出，供外部系统监听
        Instance.EntFireAtName({
            name: "flip_game_complete",
            input: "OnComplete",
            value: this.instanceId
        });
    }

    /**
     * 销毁网格
     */
    private destroyGrid(): void {
        // 断开所有输出连接
        this.connections.forEach(connId => {
            Instance.DisconnectOutput(connId);
        });
        this.connections = [];

        // 移除所有格子实体
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i]) {
                for (let j = 0; j < (this.cells[i]?.length as number); j++) {
                    const cell = this.cells[i]![j];
                    if (cell?.IsValid()) {
                        cell.Remove();
                    }
                }
            }
        }

        // 重置数组
        this.cells = [];
        this.grid = [];
        this.fixedCells = [];
    }

    /**
     * 开始游戏
     */
    public startGame(): void {
        if (this.gameActive) {
            this.stopGame();
        }

        this.gameActive = true;
        this.isCompleted = false;
        this.createGrid();

        utils.printl(`[${this.instanceId}] Flip Game 开始！网格大小: ${this.config.gridSize}x${this.config.gridSize}`);

        this.showGameInfo();

        // 播放开始音效（如果有）
        if (Instance.FindEntityByName("flip_game_sound_start")) {
            Instance.EntFireAtName({
                name: "flip_game_sound_start",
                input: "PlaySound"
            });
        }
    }

    /**
     * 显示游戏信息
     */
    private showGameInfo(): void {
        Instance.DebugScreenText({
            text: `Flip Game ${this.config.gridSize}x${this.config.gridSize}\n射击格子翻转颜色\n目标是让所有非灰色格子变成相同颜色`,
            x: 0.5, y: 0.1, duration: 5,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });

        // 显示固定格子数量
        let fixedCount = 0;
        for (let i = 0; i < this.config.gridSize; i++) {
            for (let j = 0; j < this.config.gridSize; j++) {
                if (this.fixedCells[i]![j]) fixedCount++;
            }
        }

        if (fixedCount > 0) {
            utils.printl(`[${this.instanceId}] 固定格子数量: ${fixedCount}`);
        }
    }

    /**
     * 重置游戏
     */
    public resetGame(): void {
        if (!this.gameActive) return;

        utils.printl(`[${this.instanceId}] Flip Game 重置`);

        Instance.DebugScreenText({
            text: "游戏已重置",
            x: 0.5, y: 0.9, duration: 2,
            color: { r: 255, g: 255, b: 255, a: 255 }
        });

        this.createGrid();
    }

    /**
     * 停止游戏
     */
    public stopGame(): void {
        this.gameActive = false;
        this.destroyGrid();

        utils.printl(`[${this.instanceId}] Flip Game 停止`);
    }

    /**
     * 设置起始位置
     */
    public setStartPosition(position: Vector): void {
        this.startPosition = position;
        utils.printl(`[${this.instanceId}] 起始位置已设置: (${position.x}, ${position.y}, ${position.z})`);
    }

    /**
     * 设置起始位置实体
     */
    public setStartEntity(entityName: string): void {
        const entity = Instance.FindEntityByName(entityName);
        if (entity) {
            this.startPosition = entity.GetAbsOrigin();
            utils.printl(`[${this.instanceId}] 起始位置已从实体 ${entityName} 设置`);
        } else {
            utils.printl(`[${this.instanceId}] 错误：未找到实体 ${entityName}`);
        }
    }

    /**
     * 获取游戏状态
     */
    public getGameState(): {
        active: boolean;
        completed: boolean;
        gridSize: number;
        instanceId: string;
    } {
        return {
            active: this.gameActive,
            completed: this.isCompleted,
            gridSize: this.config.gridSize,
            instanceId: this.instanceId
        };
    }

    /**
     * 获取实例ID
     */
    public getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * 检查游戏是否完成
     */
    public isGameCompleted(): boolean {
        return this.isCompleted;
    }

    /**
     * 检查游戏是否活跃
     */
    public isGameActive(): boolean {
        return this.gameActive;
    }

    /**
     * 获取配置信息
     */
    public getConfig(): any {
        return {
            gridSize: this.config.gridSize,
            fixedCellProbability: this.config.fixedCellProbability,
            spacing: this.config.spacing,
            instanceId: this.instanceId
        };
    }
}