import { Assets, Texture } from "pixi.js";
import {
  CUBE_TEXTURE_PATHS,
  GRID_TEXTURE_PATHS,
  type CubeColorId,
  type GridBoxId,
} from "./gameColors";

// Re-export the pure colour helpers so Pixi-side callers have a single import.
export * from "./gameColors";

const ALL_GAME_TEXTURES = [
  ...Object.values(CUBE_TEXTURE_PATHS),
  ...Object.values(GRID_TEXTURE_PATHS),
];

let preloadPromise: Promise<void> | null = null;

export function getCubeTexture(color: CubeColorId): Texture {
  return Texture.from(CUBE_TEXTURE_PATHS[color]);
}

export function getGridTexture(box: GridBoxId): Texture {
  return Texture.from(GRID_TEXTURE_PATHS[box]);
}

export function preloadGameTextures(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = Assets.load(ALL_GAME_TEXTURES)
      .then(() => undefined)
      .catch((err) => {
        // Drop the cached promise so a later init can retry the load instead of
        // forever resolving (rejecting) with this failure.
        preloadPromise = null;
        throw err;
      });
  }
  return preloadPromise;
}
