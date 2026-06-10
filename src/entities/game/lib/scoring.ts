import { BoardCell, FigureInstance, CalculateScoreParams } from "../model/types";
import { canPlaceAnyFigure } from "./board";

/**
 * Calculates score for cell clear events (lines or boosters).
 * If clearedLinesCount > 0, we apply a line combo multiplier:
 *   total = clearedCellsCount * clearedLinesCount * boosterMultiplier
 * If clearedLinesCount === 0 (e.g. cleared by a booster like hammer/collectAll directly),
 * it yields 1 point per cell:
 *   total = clearedCellsCount * boosterMultiplier
 */
export function calculateScore(params: CalculateScoreParams): number {
  const { clearedCellsCount, clearedLinesCount, isMultiplierActive } = params;
  if (clearedCellsCount <= 0) return 0;

  const boosterMultiplier = isMultiplierActive ? 2 : 1;

  if (clearedLinesCount > 0) {
    return clearedCellsCount * clearedLinesCount * boosterMultiplier;
  }

  return clearedCellsCount * boosterMultiplier;
}

/**
 * Checks if the victory target has been reached.
 */
export function checkWinCondition(score: number, targetScore: number): boolean {
  return score >= targetScore;
}

/**
 * Checks if there are no playable moves remaining.
 * Returns true if there are unplaced figures and none of them can be placed on the board.
 */
export function checkLoseCondition(board: BoardCell[][], figures: FigureInstance[]): boolean {
  return !canPlaceAnyFigure(board, figures);
}
