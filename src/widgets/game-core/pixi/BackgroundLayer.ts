import { Graphics } from "pixi.js";
import { LevelConfig } from "@/entities/game/model/types";

/** Wood-tone palettes keyed by LevelConfig.visual.backgroundId. */
const WOOD_THEMES: Record<string, { base: number; plankA: number; plankB: number; seam: number }> = {
  wood_classic: { base: 0x3a2412, plankA: 0x4a2f17, plankB: 0x402812, seam: 0x24150a },
  wood_dark: { base: 0x1a0f07, plankA: 0x2b1a0d, plankB: 0x231408, seam: 0x130b05 },
  wood_royal: { base: 0x3a1810, plankA: 0x52221a, plankB: 0x451a13, seam: 0x280f0a },
};

/**
 * Static wooden plank background. Drawn once per config; carries no per-frame
 * cost. Kept separate from GameScene so the scene only orchestrates gameplay.
 */
export class BackgroundLayer extends Graphics {
  draw(config: LevelConfig, sceneW: number, sceneH: number) {
    this.clear();
    const theme = WOOD_THEMES[config.visual?.backgroundId] ?? WOOD_THEMES.wood_classic;

    // Base fill.
    this.rect(0, 0, sceneW, sceneH).fill({ color: theme.base });

    // Horizontal wooden planks with a darker seam between each.
    const plankCount = 7;
    const plankH = sceneH / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const y = i * plankH;
      this.rect(0, y, sceneW, plankH).fill({ color: i % 2 === 0 ? theme.plankA : theme.plankB });
      // Seam line at the top of each plank.
      this.rect(0, y, sceneW, 2).fill({ color: theme.seam, alpha: 0.7 });

      // Subtle grain streaks along the plank.
      for (let s = 0; s < 3; s++) {
        const gy = y + plankH * (0.25 + s * 0.25);
        this.rect(0, gy, sceneW, 1).fill({ color: theme.seam, alpha: 0.12 });
      }
    }

    // Soft vignette: darker top and bottom edges for depth.
    this.rect(0, 0, sceneW, 80).fill({ color: 0x000000, alpha: 0.22 });
    this.rect(0, sceneH - 120, sceneW, 120).fill({ color: 0x000000, alpha: 0.25 });
    this.rect(0, 0, sceneW, sceneH).fill({ color: 0x000000, alpha: 0.08 });
  }
}
