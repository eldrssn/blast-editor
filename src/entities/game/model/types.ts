export type BoosterType = "collectAll" | "multiplier" | "hammer";

export type BoardCellConfig = {
  filled: boolean;
  color?: string;
  hasWater?: boolean;
};

export type LevelConfig = {
  levelId: string;
  title: string;
  grid: {
    rows: number;
    cols: number;
  };
  targetScore: number;
  initialBoard: Array<Array<BoardCellConfig | null>>;
  figures: {
    availableShapeIds: string[];
    spawnWeights: Record<string, number>;
    colors: string[];
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
      areaRows: number;
      areaCols: number;
    };
  };
  protectionFromLoss: {
    enabled: boolean;
    clearBoardCost: number;
  };
  visual: {
    backgroundId: string;
    cubeStyle: "pseudo3d";
    showDebugGrid: boolean;
    /** Master toggle for animations/particles (item 12: эффекты отключаемы). */
    effectsEnabled: boolean;
    /** Master toggle for Howler sound effects. */
    soundEnabled: boolean;
  };
};

export type BoardCell = {
  id: string;
  filled: boolean;
  color?: string;
  figureId?: string;
  hasWater?: boolean;
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
  color: string;
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
  config: LevelConfig;
  board: BoardCell[][];
  currentFigures: FigureInstance[];
  score: number;
  targetScore: number;
  activeBooster: BoosterType | null;
  isMultiplierActive: boolean;
  boosterInventory: Record<BoosterType, number>;
};

export type GridPosition = {
  row: number;
  col: number;
};

export type CompletedLine = {
  type: "row" | "col";
  index: number;
};

export type ClearResult = {
  board: BoardCell[][];
  clearedCellsCount: number;
  clearedLinesCount: number;
  clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }>;
};

export type CalculateScoreParams = {
  clearedCellsCount: number;
  clearedLinesCount: number;
  isMultiplierActive: boolean;
};

export type HammerArea = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};
