import { BoardCell, FigureInstance, LevelConfig } from "../model/types";
import { canPlaceAnyFigure } from "./board";
import { checkWinCondition } from "./scoring";
import { generateFigureSet } from "./figures";

export type PostMoveOutcome = "won" | "playing" | "lost" | "protection";

export type PostMoveResult = {
  /** What the game should transition to after this move resolves. */
  outcome: PostMoveOutcome;
  /** Figures to use going forward (a fresh set when `regenerated` is true). */
  figures: FigureInstance[];
  /** True when the previous set was fully placed and a new one was generated. */
  regenerated: boolean;
  /** Scripted-opening cursor after this move (advances by 1 on regeneration). */
  nextScriptedSetIndex: number;
};

/**
 * Pure post-move resolution: decides win / regenerate / lose / protection.
 * Kept free of rendering and side effects so the rules are testable in isolation
 * and the Pixi layer only applies the result.
 *
 * Order matches the original game flow:
 *   1. Win as soon as the target score is reached (no regeneration).
 *   2. Otherwise regenerate the set once all figures are placed.
 *   3. If nothing can be placed, offer protection (when enabled) or lose.
 *   4. Otherwise keep playing.
 */
export function resolvePostMove(
  board: BoardCell[][],
  figures: FigureInstance[],
  score: number,
  config: LevelConfig,
  scriptedSetIndex = 0
): PostMoveResult {
  if (checkWinCondition(score, config.targetScore)) {
    return { outcome: "won", figures, regenerated: false, nextScriptedSetIndex: scriptedSetIndex };
  }

  let nextFigures = figures;
  let regenerated = false;
  let nextScriptedSetIndex = scriptedSetIndex;
  if (figures.every((f) => f.placed)) {
    nextFigures = generateFigureSet(config, board, scriptedSetIndex);
    nextScriptedSetIndex = scriptedSetIndex + 1;
    regenerated = true;
  }

  if (!canPlaceAnyFigure(board, nextFigures)) {
    const protectionEnabled = config.protectionFromLoss?.enabled ?? false;
    return {
      outcome: protectionEnabled ? "protection" : "lost",
      figures: nextFigures,
      regenerated,
      nextScriptedSetIndex,
    };
  }

  return { outcome: "playing", figures: nextFigures, regenerated, nextScriptedSetIndex };
}
