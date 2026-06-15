import { BoardCell, FigureInstance, LevelConfig } from "../model/types";
import { FIGURE_SHAPES } from "../config/figureShapes";
import { canPlaceAnyFigure } from "./board";

/** Max regeneration attempts when trying to land a board-placeable set. */
const PLACEABLE_RETRIES = 12;

/**
 * Generates a set of 3 FigureInstances based on LevelConfig.
 * Uses weighted selection from availableShapeIds and randomly selects from configured colors.
 *
 * When `board` is provided, the set is regenerated (up to a bounded number of
 * attempts) until at least one figure fits, so the player never gets an
 * instantly-unplaceable set on a pre-filled board. The retry is best-effort:
 * if the board genuinely has no room it returns the last set rather than looping.
 */
export function generateFigureSet(config: LevelConfig, board?: BoardCell[][]): FigureInstance[] {
  const { availableShapeIds, spawnWeights, colors } = config.figures;

  // Set up normalized weights
  const weights = { ...spawnWeights };
  availableShapeIds.forEach((id) => {
    if (weights[id] === undefined) {
      weights[id] = 10; // default weight if missing
    }
  });

  const totalWeight = availableShapeIds.reduce((sum, id) => sum + (weights[id] || 0), 0);

  const getRandomShapeId = (): string => {
    if (totalWeight <= 0 || availableShapeIds.length === 0) {
      // Fallback
      return FIGURE_SHAPES[0]?.id || "1";
    }

    let r = Math.random() * totalWeight;
    for (const id of availableShapeIds) {
      const w = weights[id] || 0;
      if (r < w) {
        return id;
      }
      r -= w;
    }
    return availableShapeIds[0];
  };

  const buildSet = (): FigureInstance[] => {
    const instances: FigureInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const shapeId = getRandomShapeId();
      const shape = FIGURE_SHAPES.find((s) => s.id === shapeId) || FIGURE_SHAPES[0];
      const color = colors[Math.floor(Math.random() * colors.length)] || "#FF708A";

      // Generate a secure but lightweight UID
      const uid = `fig-${shapeId}-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${i}`;

      instances.push({
        uid,
        shapeId: shape.id,
        cells: shape.cells.map((c) => ({ ...c })),
        color,
        placed: false,
      });
    }
    return instances;
  };

  let set = buildSet();
  if (!board) return set;

  for (let attempt = 0; attempt < PLACEABLE_RETRIES && !canPlaceAnyFigure(board, set); attempt++) {
    set = buildSet();
  }

  return set;
}
