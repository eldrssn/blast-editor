import { BoardCell, BoardCellConfig, FigureInstance, CompletedLine, ClearResult } from "../model/types";

/**
 * Creates an empty board of size rows x cols, incorporating any pre-filled cells from the initial board configuration.
 */
export function createEmptyBoard(
  rows: number,
  cols: number,
  initialBoard?: Array<Array<BoardCellConfig | null>>
): BoardCell[][] {
  const board: BoardCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < cols; c++) {
      const initialCell = initialBoard?.[r]?.[c];
      row.push({
        id: `${r}-${c}`,
        filled: initialCell ? initialCell.filled : false,
        color: initialCell?.color,
        hasWater: initialCell ? initialCell.hasWater : false,
      });
    }
    board.push(row);
  }
  return board;
}

/**
 * Checks if a figure can be placed on the board at a specific row and col coordinate.
 * The row and col refer to the placement anchor (top-left offset of the figure cells).
 */
export function canPlaceFigure(
  board: BoardCell[][],
  figure: FigureInstance,
  row: number,
  col: number
): boolean {
  const rows = board.length;
  const cols = board[0]?.length || 0;

  for (const cell of figure.cells) {
    const targetRow = row + cell.row;
    const targetCol = col + cell.col;

    // Out of bounds
    if (targetRow < 0 || targetRow >= rows || targetCol < 0 || targetCol >= cols) {
      return false;
    }
    // Already filled
    if (board[targetRow][targetCol].filled) {
      return false;
    }
  }

  return true;
}

/**
 * Places a figure on the board at the specified row and col coordinate.
 * Returns a new board copy.
 */
export function placeFigure(
  board: BoardCell[][],
  figure: FigureInstance,
  row: number,
  col: number
): BoardCell[][] {
  const newBoard = board.map((r) => r.map((c) => ({ ...c })));
  
  for (const cell of figure.cells) {
    const targetRow = row + cell.row;
    const targetCol = col + cell.col;
    newBoard[targetRow][targetCol] = {
      ...newBoard[targetRow][targetCol],
      filled: true,
      color: figure.color,
      figureId: figure.uid,
    };
  }
  
  return newBoard;
}

/**
 * Finds all completed horizontal rows and vertical columns on the board.
 */
export function findCompletedLines(board: BoardCell[][]): CompletedLine[] {
  const lines: CompletedLine[] = [];
  const rows = board.length;
  const cols = board[0]?.length || 0;

  // Check rows
  for (let r = 0; r < rows; r++) {
    if (board[r].every((cell) => cell.filled)) {
      lines.push({ type: "row", index: r });
    }
  }

  // Check columns
  for (let c = 0; c < cols; c++) {
    let isColFilled = true;
    for (let r = 0; r < rows; r++) {
      if (!board[r][c].filled) {
        isColFilled = false;
        break;
      }
    }
    if (isColFilled) {
      lines.push({ type: "col", index: c });
    }
  }

  return lines;
}

/**
 * Clears the specified lines from the board.
 * Returns a ClearResult containing the new board and list of cleared coordinates.
 */
export function clearCompletedLines(board: BoardCell[][], lines: CompletedLine[]): ClearResult {
  const rows = board.length;
  const cols = board[0]?.length || 0;

  const cellsToClear = new Set<string>();
  for (const line of lines) {
    if (line.type === "row") {
      for (let c = 0; c < cols; c++) {
        cellsToClear.add(`${line.index}-${c}`);
      }
    } else {
      for (let r = 0; r < rows; r++) {
        cellsToClear.add(`${r}-${line.index}`);
      }
    }
  }

  const clearedCellCoords: Array<{ row: number; col: number; color?: string; hasWater?: boolean }> = [];
  const newBoard = board.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      if (cellsToClear.has(`${rowIdx}-${colIdx}`)) {
        clearedCellCoords.push({
          row: rowIdx,
          col: colIdx,
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
    clearedCellsCount: cellsToClear.size,
    clearedLinesCount: lines.length,
    clearedCellCoords,
  };
}

/**
 * Checks if at least one of the unplaced figures can fit anywhere on the board.
 */
export function canPlaceAnyFigure(board: BoardCell[][], figures: FigureInstance[]): boolean {
  const unplacedFigures = figures.filter((f) => !f.placed);
  if (unplacedFigures.length === 0) {
    return true; // No unplaced figures, waiting for next generation set.
  }

  const rows = board.length;
  const cols = board[0]?.length || 0;

  for (const figure of unplacedFigures) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (canPlaceFigure(board, figure, r, c)) {
          return true;
        }
      }
    }
  }

  return false;
}
