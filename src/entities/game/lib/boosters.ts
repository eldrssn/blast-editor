import { BoardCell, HammerArea } from "../model/types";

/**
 * Collect All booster: Clears all filled cells on the board.
 * Returns the updated board and information about cleared cells.
 */
export function applyCollectAll(board: BoardCell[][]): {
  board: BoardCell[][];
  clearedCellsCount: number;
  clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }>;
} {
  const clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }> = [];
  
  const newBoard = board.map((row, r) =>
    row.map((cell, c) => {
      if (cell.filled) {
        clearedCellCoords.push({
          row: r,
          col: c,
          color: cell.color,
          hasWater: cell.hasWater,
        });
        
        return {
          ...cell,
          filled: false,
          color: undefined,
          figureId: undefined,
          hasWater: false,
        };
      }
      return { ...cell };
    })
  );

  return {
    board: newBoard,
    clearedCellsCount: clearedCellCoords.length,
    clearedCellCoords,
  };
}

/**
 * Hammer booster: Clears all filled cells within a designated HammerArea bounding box.
 * Returns the updated board and information about cleared cells.
 */
export function applyHammer(
  board: BoardCell[][],
  area: HammerArea
): {
  board: BoardCell[][];
  clearedCellsCount: number;
  clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }>;
} {
  const clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }> = [];

  const newBoard = board.map((row, r) =>
    row.map((cell, c) => {
      const isInside =
        r >= area.startRow &&
        r <= area.endRow &&
        c >= area.startCol &&
        c <= area.endCol;

      if (isInside && cell.filled) {
        clearedCellCoords.push({
          row: r,
          col: c,
          color: cell.color,
          hasWater: cell.hasWater,
        });

        return {
          ...cell,
          filled: false,
          color: undefined,
          figureId: undefined,
          hasWater: false,
        };
      }
      return { ...cell };
    })
  );

  return {
    board: newBoard,
    clearedCellsCount: clearedCellCoords.length,
    clearedCellCoords,
  };
}
