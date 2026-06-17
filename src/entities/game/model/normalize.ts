import { LevelConfig, BoardCellConfig, ScriptedFigure } from "./types";

export function normalizeLevelConfig(config: Partial<LevelConfig> | null | undefined): LevelConfig {
  const levelId = config?.levelId || "custom_level";
  const rows = config?.grid?.rows || 8;
  const cols = config?.grid?.cols || 8;
  const targetScore = config?.targetScore || 100;

  // Normalize initial board
  const initialBoard: Array<Array<BoardCellConfig | null>> = [];
  if (config?.initialBoard && Array.isArray(config.initialBoard)) {
    for (let r = 0; r < rows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      const configRow = config.initialBoard[r];
      for (let c = 0; c < cols; c++) {
        if (configRow && configRow[c]) {
          row.push({
            filled: !!configRow[c]?.filled,
            color: configRow[c]?.color || "#FF708A"
          });
        } else {
          row.push(null);
        }
      }
      initialBoard.push(row);
    }
  } else {
    for (let r = 0; r < rows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      for (let c = 0; c < cols; c++) {
        row.push(null);
      }
      initialBoard.push(row);
    }
  }

  const availableShapeIds = config?.figures?.availableShapeIds || ["1", "2", "3", "4", "5", "7", "10"];
  const spawnWeights = config?.figures?.spawnWeights || {};
  const normalizedWeights: Record<string, number> = {};
  availableShapeIds.forEach((id) => {
    normalizedWeights[id] = spawnWeights[id] !== undefined ? spawnWeights[id] : 10;
  });

  const colors = config?.figures?.colors || ["#FF708A", "#3CD070", "#3C70FF", "#F59E0B", "#B070FF"];

  // Scripted opening: up to 9 entries (3 sets). Keep a shapeId only when it is a
  // known available shape; anything else collapses to a random slot ({}).
  const availableSet = new Set(availableShapeIds);
  const rawScripted = Array.isArray(config?.figures?.scriptedOpening) ? config!.figures!.scriptedOpening! : [];
  const normalizedScripted: ScriptedFigure[] = rawScripted.slice(0, 9).map((entry) => {
    const id = entry?.shapeId;
    return id && availableSet.has(id) ? { shapeId: id } : {};
  });
  // The editor scripts whole sets of 3, so keep the length set-aligned: the
  // chosen set count (including sets left fully random) must survive the
  // round-trip and keep showing in the editor. Only when nothing at all is
  // pinned is the script a no-op — then drop the field so configs stay clean.
  while (normalizedScripted.length % 3 !== 0) normalizedScripted.push({});
  const hasPinnedScript = normalizedScripted.some((e) => e.shapeId);
  if (!hasPinnedScript) normalizedScripted.length = 0;

  const boosters = {
    collectAll: {
      enabled: config?.boosters?.collectAll?.enabled !== false,
      initialCount: config?.boosters?.collectAll?.initialCount ?? 1
    },
    multiplier: {
      enabled: config?.boosters?.multiplier?.enabled !== false,
      initialCount: config?.boosters?.multiplier?.initialCount ?? 1,
      multiplierValue: config?.boosters?.multiplier?.multiplierValue ?? 2,
      duration: "until_level_end" as const
    },
    hammer: {
      enabled: config?.boosters?.hammer?.enabled !== false,
      initialCount: config?.boosters?.hammer?.initialCount ?? 1
      // Зона действия молотка всегда 4×4 (HAMMER_AREA_SIZE), не из конфига.
    }
  };

  const protectionFromLoss = {
    enabled: config?.protectionFromLoss?.enabled !== false
  };

  const visual = {
    backgroundId: config?.visual?.backgroundId || "wood_classic",
    cubeStyle: (config?.visual?.cubeStyle || "pseudo3d") as "pseudo3d",
    showDebugGrid: !!config?.visual?.showDebugGrid
  };

  return {
    levelId,
    grid: { rows, cols },
    targetScore,
    initialBoard,
    figures: {
      availableShapeIds,
      spawnWeights: normalizedWeights,
      colors,
      ...(normalizedScripted.length > 0 ? { scriptedOpening: normalizedScripted } : {})
    },
    boosters,
    protectionFromLoss,
    visual
  };
}
