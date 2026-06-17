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
 *
 * `scriptedSetIndex` selects which slice of `config.figures.scriptedOpening` pins
 * this set (set S uses entries [S*3 .. S*3+2]). Pinned slots keep their shapeId;
 * unpinned slots stay weighted-random, and the placeability retry only re-rolls
 * the unpinned slots so the scripted opening is preserved.
 */
export function generateFigureSet(
  config: LevelConfig,
  board?: BoardCell[][],
  scriptedSetIndex = 0
): FigureInstance[] {
  const { availableShapeIds, spawnWeights, colors, scriptedOpening } = config.figures;

  /** Pinned shapeId for slot i of this set, or undefined when the slot is random. */
  const pinnedShapeId = (i: number): string | undefined => {
    const entry = scriptedOpening?.[scriptedSetIndex * 3 + i];
    const id = entry?.shapeId;
    return id && availableShapeIds.includes(id) ? id : undefined;
  };
  const allPinned = [0, 1, 2].every((i) => pinnedShapeId(i) !== undefined);

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
      const shapeId = pinnedShapeId(i) ?? getRandomShapeId();
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
  // A fully scripted set is fixed by the designer — don't re-roll it for
  // placeability (there's nothing random left to change anyway).
  if (!board || allPinned) return set;

  for (let attempt = 0; attempt < PLACEABLE_RETRIES && !canPlaceAnyFigure(board, set); attempt++) {
    set = buildSet();
  }

  return set;
}
