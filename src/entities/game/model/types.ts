import type { CubeColorId, GridBoxId } from "@/shared/lib/gameColors";

export type BoosterType = "collectAll" | "multiplier" | "hammer";
export type { CubeColorId, GridBoxId };

export type BoardCellConfig = {
  filled: boolean;
  color?: CubeColorId;
};

/**
 * Одна заранее заданная фигура стартового скрипта. `shapeId` отсутствует
 * (или индекс вышел за длину массива) → этот слот заполняется обычным
 * взвешенным рандомом. Цвет всегда случайный, поэтому в скрипте не хранится.
 */
export type ScriptedFigure = {
  shapeId?: string;
};

export type LevelConfig = {
  levelId: string;
  grid: {
    rows: number;
    cols: number;
  };
  targetScore: number;
  initialBoard: Array<Array<BoardCellConfig | null>>;
  figures: {
    availableShapeIds: string[];
    spawnWeights: Record<string, number>;
    colors: CubeColorId[];
    /**
     * Опциональный скрипт стартовых фигур: плоский упорядоченный список до 9
     * элементов (до 3 наборов по 3). Слот набора S, позиция i (0..2) берётся из
     * scriptedOpening[S*3 + i]. Пустой/отсутствует → весь спавн случайный.
     */
    scriptedOpening?: ScriptedFigure[];
  };
  boosters: {
    collectAll: {
      enabled: boolean;
      initialCount: number;
    };
    multiplier: {
      enabled: boolean;
      initialCount: number;
      multiplierValue: number;
      duration: "until_level_end";
    };
    hammer: {
      enabled: boolean;
      initialCount: number;
      // Зона действия молотка фиксирована 4×4 (см. HAMMER_AREA_SIZE), не настраивается.
    };
  };
  protectionFromLoss: {
    enabled: boolean;
  };
  visual: {
    backgroundId: string;
    cubeStyle: "pseudo3d";
    showDebugGrid: boolean;
  };
};

export type BoardCell = {
  id: string;
  filled: boolean;
  color?: CubeColorId;
  figureId?: string;
};

export type FigureCell = {
  row: number;
  col: number;
};

export type FigureShape = {
  id: string;
  cells: FigureCell[];
};

export type FigureInstance = {
  uid: string;
  shapeId: string;
  cells: FigureCell[];
  color: CubeColorId;
  placed: boolean;
};

export type GameStatus =
  | "idle"
  | "playing"
  | "dragging"
  | "booster_selecting"
  | "protection_from_loss"
  | "won"
  | "lost";

export type GameState = {
  status: GameStatus;
  /** Null until a level is loaded via initGame. */
  config: LevelConfig | null;
  board: BoardCell[][];
  currentFigures: FigureInstance[];
  score: number;
  targetScore: number;
  activeBooster: BoosterType | null;
  isMultiplierActive: boolean;
  boosterInventory: Record<BoosterType, number>;
  /** Сколько стартовых наборов уже взято из figures.scriptedOpening. */
  scriptedSetIndex: number;
};

export type GridPosition = {
  row: number;
  col: number;
};

export type CompletedLine = {
  type: "row" | "col";
  index: number;
};

/** A cleared cell snapshot used to animate pops + water droplets. */
export type ClearedCellCoord = {
  row: number;
  col: number;
  color?: CubeColorId;
};

export type ClearResult = {
  board: BoardCell[][];
  clearedCellsCount: number;
  clearedLinesCount: number;
  clearedCellCoords: ClearedCellCoord[];
};

export type CalculateScoreParams = {
  clearedCellsCount: number;
  clearedLinesCount: number;
  isMultiplierActive: boolean;
  /** Configured multiplier value applied while the booster is active (default 2). */
  multiplierValue?: number;
};

export type HammerArea = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};
