export type BoosterType = "collectAll" | "multiplier" | "hammer";

export type BoardCellConfig = {
  filled: boolean;
  color?: string;
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
  color?: string;
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
  /** Null until a level is loaded via initGame. */
  config: LevelConfig | null;
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

/** A cleared cell snapshot used to animate pops + water droplets. */
export type ClearedCellCoord = {
  row: number;
  col: number;
  color?: string;
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
