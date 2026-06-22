// Pure (Pixi-free) source of truth for cube colours and grid-tile variants.
// Lives in `shared` with no dependency on `entities`/Pixi so it can be imported
// by pure game logic (normalize/validation) and React UI alike. Texture loading
// that actually needs Pixi lives in the sibling `gameAssets.ts`.

export const CUBE_COLOR_IDS = ["green", "orange", "purple", "red", "yellow"] as const;
export type CubeColorId = (typeof CUBE_COLOR_IDS)[number];

export const GRID_BOX_IDS = ["box-1", "box-2", "box-3"] as const;
export type GridBoxId = (typeof GRID_BOX_IDS)[number];

export const CUBE_TEXTURE_PATHS: Record<CubeColorId, string> = {
  green: "/game/cubes/green.webp",
  orange: "/game/cubes/orange.webp",
  purple: "/game/cubes/purple.webp",
  red: "/game/cubes/red.webp",
  yellow: "/game/cubes/yellow.webp",
};

export const GRID_TEXTURE_PATHS: Record<GridBoxId, string> = {
  "box-1": "/game/grid/box-1.webp",
  "box-2": "/game/grid/box-2.webp",
  "box-3": "/game/grid/box-3.webp",
};

// Migration map for levels saved before the move from hex fills to named cube
// textures. There is no blue texture in the new set, so the old cobalt blue
// (#3C70FF) is deliberately collapsed to yellow — keep this in sync with the
// hex→id replacements in defaultLevels.ts.
const LEGACY_HEX_TO_COLOR_ID: Record<string, CubeColorId> = {
  "#3CD070": "green",
  "#F59E0B": "orange",
  "#B070FF": "purple",
  "#FF708A": "red",
  "#3C70FF": "yellow",
};

export function isCubeColorId(value: string): value is CubeColorId {
  return (CUBE_COLOR_IDS as readonly string[]).includes(value);
}

export function isGridBoxId(value: string): value is GridBoxId {
  return (GRID_BOX_IDS as readonly string[]).includes(value);
}

/** True for a current id or a legacy hex value that `normalizeCubeColorId` can migrate. */
export function isMigratableCubeColorId(value: string): boolean {
  return isCubeColorId(value) || value.toUpperCase() in LEGACY_HEX_TO_COLOR_ID;
}

export function normalizeCubeColorId(value: string | null | undefined): CubeColorId {
  if (value && isCubeColorId(value)) return value;
  const legacy = value ? LEGACY_HEX_TO_COLOR_ID[value.toUpperCase()] : undefined;
  return legacy ?? "red";
}

export function getCubeAssetUrl(color: CubeColorId): string {
  return CUBE_TEXTURE_PATHS[color];
}

/** Deterministic grid-tile variant per cell (co-prime multipliers spread the 3 boxes). */
export function getStableGridBoxId(row: number, col: number): GridBoxId {
  return GRID_BOX_IDS[(row * 17 + col * 31) % GRID_BOX_IDS.length];
}
