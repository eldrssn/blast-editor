import { LevelConfig, BoardCellConfig } from "../model/types";
import { DEFAULT_FIGURE_WEIGHTS } from "./figureShapes";

const defaultColors = [
  "#FF708A", // Premium Rose
  "#3CD070", // Premium Emerald
  "#3C70FF", // Premium Cobalt
  "#F59E0B", // Premium Amber
  "#B070FF"  // Premium Purple
];

const ROSE = "#FF708A";
const EMERALD = "#3CD070";
const COBALT = "#3C70FF";
const AMBER = "#F59E0B";
const PURPLE = "#B070FF";

// Helper to create an empty initial board configuration
function createEmptyInitialBoard(rows: number, cols: number): Array<Array<BoardCellConfig | null>> {
  const board: Array<Array<BoardCellConfig | null>> = [];
  for (let r = 0; r < rows; r++) {
    const row: Array<BoardCellConfig | null> = [];
    for (let c = 0; c < cols; c++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

/**
 * Build an initial board and paint pre-filled obstacle cells via a callback.
 * `set(r, c, color)` ignores out-of-bounds coordinates so patterns stay safe.
 */
function paintBoard(
  rows: number,
  cols: number,
  paint: (set: (r: number, c: number, color: string) => void) => void
): Array<Array<BoardCellConfig | null>> {
  const board = createEmptyInitialBoard(rows, cols);
  const set = (r: number, c: number, color: string) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      board[r][c] = { filled: true, color };
    }
  };
  paint(set);
  return board;
}

export const DEFAULT_LEVELS: LevelConfig[] = [
  {
    levelId: "level_1",
    grid: { rows: 8, cols: 8 },
    targetScore: 60,
    initialBoard: createEmptyInitialBoard(8, 8),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "7", "10"], // Simpler shapes for level 1
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 1 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 1, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 10 },
    visual: {
      backgroundId: "wood_classic",
      cubeStyle: "pseudo3d",
      showDebugGrid: false
    }
  },
  {
    levelId: "level_2",
    grid: { rows: 8, cols: 8 },
    targetScore: 120,
    initialBoard: (() => {
      const board = createEmptyInitialBoard(8, 8);
      // Place some random blocks on the board to start with
      board[7][0] = { filled: true, color: "#3CD070" };
      board[7][1] = { filled: true, color: "#3CD070" };
      board[7][6] = { filled: true, color: "#3C70FF" };
      board[7][7] = { filled: true, color: "#3C70FF" };
      board[6][0] = { filled: true, color: "#FF708A" };
      board[6][7] = { filled: true, color: "#FF708A" };
      return board;
    })(),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 20 },
    visual: {
      backgroundId: "wood_dark",
      cubeStyle: "pseudo3d",
      showDebugGrid: false
    }
  },
  {
    levelId: "level_3",
    grid: { rows: 8, cols: 8 },
    targetScore: 200,
    initialBoard: (() => {
      const board = createEmptyInitialBoard(8, 8);
      // Put a solid block in the center to make it tricky
      board[3][3] = { filled: true, color: "#B070FF" };
      board[3][4] = { filled: true, color: "#B070FF" };
      board[4][3] = { filled: true, color: "#B070FF" };
      board[4][4] = { filled: true, color: "#B070FF" };
      return board;
    })(),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"], // All including hardest shape 15
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 2, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 3, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 30 },
    visual: {
      backgroundId: "wood_royal",
      cubeStyle: "pseudo3d",
      showDebugGrid: false
    }
  },

  // ─── Lvl 4: лёгкий, чистое поле, чуть выше цель ───────────────────
  {
    levelId: "level_4",
    grid: { rows: 8, cols: 8 },
    targetScore: 90,
    initialBoard: createEmptyInitialBoard(8, 8),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "10"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 1, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 15 },
    visual: { backgroundId: "wood_classic", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 5: лёгкий-средний, блоки в нижних углах ──────────────────
  {
    levelId: "level_5",
    grid: { rows: 8, cols: 8 },
    targetScore: 130,
    initialBoard: paintBoard(8, 8, (set) => {
      set(7, 0, EMERALD); set(7, 1, EMERALD);
      set(7, 6, COBALT); set(7, 7, COBALT);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 15 },
    visual: { backgroundId: "wood_dark", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 6: средний, сетка 9×9, заняты углы ───────────────────────
  {
    levelId: "level_6",
    grid: { rows: 9, cols: 9 },
    targetScore: 160,
    initialBoard: paintBoard(9, 9, (set) => {
      set(0, 0, ROSE); set(0, 8, AMBER);
      set(8, 0, COBALT); set(8, 8, PURPLE);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 20 },
    visual: { backgroundId: "wood_royal", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 7: средний, полоса-перегородка в центре ──────────────────
  {
    levelId: "level_7",
    grid: { rows: 8, cols: 8 },
    targetScore: 180,
    initialBoard: paintBoard(8, 8, (set) => {
      for (let c = 2; c <= 5; c++) set(4, c, AMBER);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 1 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 20 },
    visual: { backgroundId: "wood_classic", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 8: средний-сложный, два блока 2×2 по диагонали ───────────
  {
    levelId: "level_8",
    grid: { rows: 8, cols: 8 },
    targetScore: 200,
    initialBoard: paintBoard(8, 8, (set) => {
      set(0, 0, ROSE); set(0, 1, ROSE); set(1, 0, ROSE); set(1, 1, ROSE);
      set(6, 6, PURPLE); set(6, 7, PURPLE); set(7, 6, PURPLE); set(7, 7, PURPLE);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 2, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 25 },
    visual: { backgroundId: "wood_dark", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 9: сложный, 9×9, только крупные фигуры, маркеры краёв ─────
  {
    levelId: "level_9",
    grid: { rows: 9, cols: 9 },
    targetScore: 240,
    initialBoard: paintBoard(9, 9, (set) => {
      for (const c of [0, 4, 8]) { set(0, c, COBALT); set(8, c, COBALT); }
    }),
    figures: {
      availableShapeIds: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 25 },
    visual: { backgroundId: "wood_royal", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 10: сложный, центральный блок + краевые столбики ─────────
  {
    levelId: "level_10",
    grid: { rows: 8, cols: 8 },
    targetScore: 260,
    initialBoard: paintBoard(8, 8, (set) => {
      set(3, 3, PURPLE); set(3, 4, PURPLE); set(4, 3, PURPLE); set(4, 4, PURPLE);
      set(0, 3, AMBER); set(0, 4, AMBER); set(7, 3, AMBER); set(7, 4, AMBER);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 1 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 30 },
    visual: { backgroundId: "wood_classic", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 11: сложный, 9×9, диагональ-препятствие, упор на ×3 ───────
  {
    levelId: "level_11",
    grid: { rows: 9, cols: 9 },
    targetScore: 300,
    initialBoard: paintBoard(9, 9, (set) => {
      for (let i = 0; i < 9; i++) set(i, i, ROSE);
    }),
    figures: {
      availableShapeIds: ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS, "15": 4 },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 2, multiplierValue: 3, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 3, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 30 },
    visual: { backgroundId: "wood_dark", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 12: сложный, большое поле 10×10, рассыпанные блоки ────────
  {
    levelId: "level_12",
    grid: { rows: 10, cols: 10 },
    targetScore: 360,
    initialBoard: paintBoard(10, 10, (set) => {
      for (let r = 1; r < 10; r += 3) {
        for (let c = 1; c < 10; c += 3) set(r, c, EMERALD);
      }
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 35 },
    visual: { backgroundId: "wood_royal", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 13: очень сложный, тесное 7×7, только крупные фигуры ──────
  {
    levelId: "level_13",
    grid: { rows: 7, cols: 7 },
    targetScore: 300,
    initialBoard: paintBoard(7, 7, (set) => {
      set(5, 0, AMBER); set(5, 1, AMBER); set(6, 0, AMBER); set(6, 1, AMBER);
    }),
    figures: {
      availableShapeIds: ["5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 1 },
      multiplier: { enabled: true, initialCount: 1, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 2, areaRows: 3, areaCols: 3 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 35 },
    visual: { backgroundId: "wood_classic", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 14: очень сложный, 9×9, пунктирная рамка ─────────────────
  {
    levelId: "level_14",
    grid: { rows: 9, cols: 9 },
    targetScore: 420,
    initialBoard: paintBoard(9, 9, (set) => {
      for (let i = 0; i < 9; i += 2) {
        set(0, i, COBALT); set(8, i, COBALT);
        set(i, 0, ROSE); set(i, 8, ROSE);
      }
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 2 },
      multiplier: { enabled: true, initialCount: 2, multiplierValue: 2, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 3, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 40 },
    visual: { backgroundId: "wood_dark", cubeStyle: "pseudo3d", showDebugGrid: false }
  },

  // ─── Lvl 15: финальный, 10×10, рамка + центр, упор на фигуру 15 ────
  {
    levelId: "level_15",
    grid: { rows: 10, cols: 10 },
    targetScore: 520,
    initialBoard: paintBoard(10, 10, (set) => {
      for (let i = 0; i < 10; i += 2) {
        set(0, i, PURPLE); set(9, i, PURPLE);
        set(i, 0, AMBER); set(i, 9, AMBER);
      }
      set(4, 4, COBALT); set(4, 5, COBALT); set(5, 4, COBALT); set(5, 5, COBALT);
    }),
    figures: {
      availableShapeIds: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
      spawnWeights: { ...DEFAULT_FIGURE_WEIGHTS, "15": 6 },
      colors: defaultColors
    },
    boosters: {
      collectAll: { enabled: true, initialCount: 3 },
      multiplier: { enabled: true, initialCount: 2, multiplierValue: 3, duration: "until_level_end" },
      hammer: { enabled: true, initialCount: 3, areaRows: 4, areaCols: 4 }
    },
    protectionFromLoss: { enabled: true, clearBoardCost: 50 },
    visual: { backgroundId: "wood_royal", cubeStyle: "pseudo3d", showDebugGrid: false }
  }
];
