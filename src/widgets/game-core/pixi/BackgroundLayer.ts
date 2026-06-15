import { Graphics } from "pixi.js";
import { LevelConfig } from "@/entities/game/model/types";

/** Flat light-brown background used across all levels. */
const BACKGROUND_COLOR = 0xb88952;

/**
 * Static game background. Drawn once per config; carries no per-frame cost.
 * Kept separate from GameScene so the scene only orchestrates gameplay.
 */
export class BackgroundLayer extends Graphics {
  draw(_config: LevelConfig, sceneW: number, sceneH: number) {
    this.clear();
    this.rect(0, 0, sceneW, sceneH).fill({ color: BACKGROUND_COLOR });
  }
}
