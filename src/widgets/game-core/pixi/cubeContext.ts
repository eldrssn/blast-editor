import { Graphics, GraphicsContext } from "pixi.js";
import { drawPseudo3DCube } from "./cube";

/**
 * Cache of shared GraphicsContexts for pseudo-3D cubes, keyed by color + size.
 *
 * In Pixi v8 every `Graphics` owns a `GraphicsContext` whose path is tessellated
 * into GPU geometry once and then reused. By sharing one context across all
 * cubes of the same color/size — board cells, clear-effect pops — we tessellate
 * each distinct cube a single time instead of on every board redraw, which is
 * the bulk of the per-placement CPU cost on weak devices.
 *
 * Output is pixel-identical to calling drawPseudo3DCube directly.
 */
const cache = new Map<string, GraphicsContext>();

export function getCubeContext(color: string, size: number): GraphicsContext {
  const key = `${color}@${Math.round(size)}`;
  let ctx = cache.get(key);
  if (!ctx) {
    // Build the path once via a throwaway Graphics, then keep its context.
    const g = new Graphics();
    drawPseudo3DCube(g, 0, 0, size, color);
    ctx = g.context;
    cache.set(key, ctx);
  }
  return ctx;
}
