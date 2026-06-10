import { LevelConfig, BoardCellConfig } from "../model/types";
import { DEFAULT_FIGURE_WEIGHTS } from "./figureShapes";

const defaultColors = [
  "#FF708A", // Premium Rose
  "#3CD070", // Premium Emerald
  "#3C70FF", // Premium Cobalt
  "#F59E0B", // Premium Amber
  "#B070FF"  // Premium Purple
];

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

export const DEFAULT_LEVELS: LevelConfig[] = [
  {
    levelId: "level_1",
    title: "Обучение: Первые линии",
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
      showDebugGrid: false,
      effectsEnabled: true,
      soundEnabled: true
    }
  },
  {
    levelId: "level_2",
    title: "Капли дождя",
    grid: { rows: 8, cols: 8 },
    targetScore: 120,
    initialBoard: (() => {
      const board = createEmptyInitialBoard(8, 8);
      // Place some random blocks on the board to start with
      board[7][0] = { filled: true, color: "#3CD070", hasWater: true };
      board[7][1] = { filled: true, color: "#3CD070", hasWater: false };
      board[7][6] = { filled: true, color: "#3C70FF", hasWater: true };
      board[7][7] = { filled: true, color: "#3C70FF", hasWater: false };
      board[6][0] = { filled: true, color: "#FF708A", hasWater: false };
      board[6][7] = { filled: true, color: "#FF708A", hasWater: false };
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
      showDebugGrid: false,
      effectsEnabled: true,
      soundEnabled: true
    }
  },
  {
    levelId: "level_3",
    title: "Тяжелое испытание",
    grid: { rows: 8, cols: 8 },
    targetScore: 200,
    initialBoard: (() => {
      const board = createEmptyInitialBoard(8, 8);
      // Put a solid block in the center to make it tricky
      board[3][3] = { filled: true, color: "#B070FF", hasWater: false };
      board[3][4] = { filled: true, color: "#B070FF", hasWater: true };
      board[4][3] = { filled: true, color: "#B070FF", hasWater: true };
      board[4][4] = { filled: true, color: "#B070FF", hasWater: false };
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
      showDebugGrid: false,
      effectsEnabled: true,
      soundEnabled: true
    }
  }
];
