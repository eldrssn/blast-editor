import { Graphics } from "pixi.js";

/** Vertical depth offset for the pseudo-3D side faces. */
export const DEPTH = 5;
/** Corner radius for rounded blocks (shared by board cells + highlights). */
export const CORNER_RADIUS = 5;

/** Scale a hex color channel-wise. factor<1 darkens, factor>1 lightens (clamped). */
function scaleColor(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const gb = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `#${r.toString(16).padStart(2, "0")}${gb.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Draws a pseudo-3D cube into the given graphics at (x, y) with size×size.
 * The cube has a soft drop shadow, right/bottom dark faces, a top face with a
 * vertical gradient band, an inner bevel rim and a glossy highlight.
 *
 * Shared by the board, the figure slots, the drag preview and the clear effects
 * so every cube renders identically.
 */
export function drawPseudo3DCube(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1
) {
  const sideColor = scaleColor(color, 0.55);
  const bottomColor = scaleColor(color, 0.42);
  const topColor = scaleColor(color, 1.18); // lighter top band for a gradient feel

  // Soft drop shadow beneath the block (offset + slightly larger for diffusion).
  g.roundRect(x + DEPTH + 1, y + DEPTH + 2, size, size, CORNER_RADIUS).fill({
    color: 0x000000,
    alpha: 0.28 * alpha,
  });

  // Right face (dark side)
  g.poly([
    { x: x + size, y: y + CORNER_RADIUS },
    { x: x + size + DEPTH, y: y + CORNER_RADIUS + DEPTH },
    { x: x + size + DEPTH, y: y + size + DEPTH },
    { x: x + size, y: y + size },
  ]).fill({ color: sideColor, alpha });

  // Bottom face (darkest side)
  g.poly([
    { x: x + CORNER_RADIUS, y: y + size },
    { x: x + CORNER_RADIUS + DEPTH, y: y + size + DEPTH },
    { x: x + size + DEPTH, y: y + size + DEPTH },
    { x: x + size, y: y + size },
  ]).fill({ color: bottomColor, alpha });

  // Main top face
  g.roundRect(x, y, size, size, CORNER_RADIUS).fill({ color, alpha });

  // Vertical gradient: a lighter band fading down the top half.
  g.roundRect(x, y, size, size * 0.5, CORNER_RADIUS).fill({
    color: topColor,
    alpha: 0.5 * alpha,
  });

  // Inner bevel rim (dark) for crisp edge definition.
  g.roundRect(x + 0.5, y + 0.5, size - 1, size - 1, CORNER_RADIUS).stroke({
    color: scaleColor(color, 0.35),
    alpha: 0.5 * alpha,
    width: 1,
  });

  // Glossy highlight (top-left corner).
  g.roundRect(x + size * 0.12, y + size * 0.1, size * 0.5, size * 0.2, 3).fill({
    color: 0xffffff,
    alpha: 0.42 * alpha,
  });
  // Tiny sparkle dot.
  g.circle(x + size * 0.72, y + size * 0.24, Math.max(size * 0.04, 1)).fill({
    color: 0xffffff,
    alpha: 0.5 * alpha,
  });
}
