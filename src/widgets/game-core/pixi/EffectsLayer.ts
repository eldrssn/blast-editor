import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { ClearedCellCoord } from "@/entities/game/model/types";
import { getCubeTexture } from "@/shared/lib/gameAssets";

type GridInfo = {
  cellSize: number;
  boardOffsetX: number;
  boardOffsetY: number;
  rows: number;
  cols: number;
  gap: number;
};

type Point = { x: number; y: number };

type LineClearHooks = {
  /** Called once when the first water droplet reaches the progress bar. */
  onScoreArrive?: () => void;
  /** Called once when every animation in the sequence has finished. */
  onComplete?: () => void;
};

type Tween = {
  elapsed: number;
  delay: number;
  duration: number;
  ease: (t: number) => number;
  onUpdate: (t: number) => void;
  onDone?: () => void;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const WATER_COLOR = 0x5eb1ff;
const WATER_HIGHLIGHT = 0xcfeaff;

/**
 * EffectsLayer renders transient animations on top of every other layer:
 * line-clear cube pops, water-droplet fly-offs toward the progress bar,
 * and combo labels. It runs its own requestAnimationFrame tween loop and
 * cleans everything up on destroy.
 */
export class EffectsLayer extends Container {
  private tweens: Tween[] = [];
  private rafId: number | null = null;
  private lastTime = 0;
  private isDestroyed = false;

  /**
   * Pool of reusable Graphics for water droplets + splash rings. Pooling avoids
   * allocating + destroying hundreds of objects per big clear (a full-board
   * Collect All), which is the main source of GC churn on weak devices.
   * (Cube pops are not pooled — they share cached contexts; clearing them would
   * wipe the shared geometry.)
   */
  private fxPool: Graphics[] = [];

  constructor() {
    super();
    this.zIndex = 100;
    // Order children by zIndex so the combo label can sit above the cube-vanish
    // sprites even though those are spawned after it within the same clear.
    this.sortableChildren = true;
    // Effects must never intercept pointer events meant for the board/figures.
    this.eventMode = "none";
  }

  /** Get a clean Graphics from the pool (or a new one) and attach it. */
  private acquireFx(): Graphics {
    const g = this.fxPool.pop() ?? new Graphics();
    g.visible = true;
    g.alpha = 1;
    g.rotation = 0;
    g.scale.set(1);
    this.addChild(g);
    return g;
  }

  /** Detach + reset a Graphics and return it to the pool. */
  private releaseFx(g: Graphics) {
    g.clear();
    this.removeChild(g);
    this.fxPool.push(g);
  }

  // ─── Tween engine ─────────────────────────────────────────────

  private addTween(t: {
    duration: number;
    onUpdate: (t: number) => void;
    delay?: number;
    ease?: (t: number) => number;
    onDone?: () => void;
  }) {
    this.tweens.push({
      elapsed: 0,
      delay: t.delay ?? 0,
      duration: t.duration,
      ease: t.ease ?? ((x) => x),
      onUpdate: t.onUpdate,
      onDone: t.onDone,
    });
    this.ensureLoop();
  }

  private ensureLoop() {
    if (this.rafId !== null || this.isDestroyed) return;
    this.lastTime = performance.now();
    const loop = () => {
      if (this.isDestroyed) {
        this.rafId = null;
        return;
      }
      const now = performance.now();
      const dt = now - this.lastTime;
      this.lastTime = now;
      this.step(dt);
      this.rafId = this.tweens.length > 0 ? requestAnimationFrame(loop) : null;
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private step(dt: number) {
    const finished: Tween[] = [];
    // Iterate over a snapshot: onDone callbacks may push new tweens.
    for (const tw of this.tweens) {
      tw.elapsed += dt;
      const active = tw.elapsed - tw.delay;
      if (active < 0) continue;
      const raw = tw.duration > 0 ? Math.min(active / tw.duration, 1) : 1;
      tw.onUpdate(tw.ease(raw));
      if (raw >= 1) finished.push(tw);
    }
    if (finished.length > 0) {
      this.tweens = this.tweens.filter((t) => !finished.includes(t));
      for (const tw of finished) tw.onDone?.();
    }
  }

  // ─── Line clear sequence ──────────────────────────────────────

  /**
   * Animate cleared cells: each cube pops (scale up → collapse + fade), then
   * a water droplet flies from the cell toward the progress bar target.
   * `onScoreArrive` fires when the first droplet lands; `onComplete` when all do.
   */
  playLineClear(
    cells: ClearedCellCoord[],
    grid: GridInfo,
    comboCount: number,
    target: Point,
    hooks: LineClearHooks
  ) {
    if (cells.length === 0) {
      hooks.onScoreArrive?.();
      hooks.onComplete?.();
      return;
    }

    if (comboCount >= 2) {
      this.showCombo(comboCount, grid);
    }

    // Scale the decorative droplets down for big clears so a full-board Collect
    // All doesn't spawn hundreds of particles at once on weak devices.
    const decorativePerCell = cells.length > 24 ? 0 : cells.length > 12 ? 1 : 2;

    // One scoring droplet per cleared cell drives the completion accounting.
    let remaining = cells.length;
    let scoreFired = false;
    const onLand = () => {
      if (!scoreFired) {
        scoreFired = true;
        hooks.onScoreArrive?.();
      }
      remaining -= 1;
      if (remaining <= 0) {
        hooks.onComplete?.();
      }
    };

    cells.forEach((cell, i) => {
      this.popCube(cell, grid, i * 14, (cx, cy) => {
        // Scoring droplet (drives accounting).
        this.spawnDroplet(cx, cy, target, onLand, false);
        // A few decorative droplets for splashiness (capped for big clears).
        for (let d = 0; d < decorativePerCell; d++) {
          this.spawnDroplet(cx, cy, target, undefined, true);
        }
      });
    });
  }

  /**
   * Vanish a set of cells with the same cube-pop as a line clear, but WITHOUT
   * the water droplets / score animation. Used by the protection-from-loss board
   * clear, which wipes the board for free (no points), so nothing flies to the HUD.
   * `onComplete` fires once every cube has popped.
   */
  playCellsVanish(cells: ClearedCellCoord[], grid: GridInfo, onComplete?: () => void) {
    if (cells.length === 0) {
      onComplete?.();
      return;
    }

    let remaining = cells.length;
    cells.forEach((cell, i) => {
      this.popCube(cell, grid, i * 14, () => {
        remaining -= 1;
        if (remaining <= 0) onComplete?.();
      });
    });
  }

  /**
   * Pop a single cell's cube: scale up briefly, then collapse + fade + spin out.
   * Shared by line clears and the protection board clear. `onDone` receives the
   * cube center so callers can spawn follow-up effects (e.g. water droplets).
   */
  private popCube(
    cell: ClearedCellCoord,
    grid: GridInfo,
    delay: number,
    onDone: (cx: number, cy: number) => void
  ) {
    const cellFull = grid.cellSize + grid.gap;
    const size = grid.cellSize;
    const cx = grid.boardOffsetX + cell.col * cellFull + size / 2;
    const cy = grid.boardOffsetY + cell.row * cellFull + size / 2;
    const color = cell.color ?? "red";

    const cube = new Sprite(getCubeTexture(color));
    cube.anchor.set(0.5);
    cube.position.set(cx, cy);
    cube.width = size;
    cube.height = size;
    // Setting width/height fits the texture to the cell; capture that base scale
    // so the tween multiplies it instead of overwriting it (which would blow the
    // cube up to the texture's native pixel size).
    const baseScale = cube.scale.x;
    this.addChild(cube);

    this.addTween({
      duration: 300,
      delay,
      ease: easeInCubic,
      onUpdate: (t) => {
        // Hold the cube at its cell size briefly, then collapse it — no pop-up.
        const scale = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
        cube.scale.set(baseScale * Math.max(scale, 0));
        cube.alpha = 1 - Math.max(0, (t - 0.4) / 0.6);
        cube.rotation = t * 0.35;
      },
      onDone: () => {
        cube.destroy();
        onDone(cx, cy);
      },
    });
  }

  private spawnDroplet(
    fromX: number,
    fromY: number,
    target: Point,
    onLand: (() => void) | undefined,
    decorative: boolean
  ) {
    const r = decorative ? 2.5 + Math.random() * 2 : 5;
    const drop = this.acquireFx();
    drop.circle(0, 0, r).fill({ color: WATER_COLOR });
    drop.circle(-r * 0.3, -r * 0.3, r * 0.4).fill({ color: WATER_HIGHLIGHT, alpha: 0.85 });
    drop.position.set(fromX, fromY);

    // Quadratic bezier arc with a control point lifted above the path.
    const cx = (fromX + target.x) / 2 + (Math.random() - 0.5) * 70;
    const cy = Math.min(fromY, target.y) - 50 - Math.random() * 50;
    const dur = 460 + Math.random() * 180;

    this.addTween({
      duration: dur,
      delay: decorative ? Math.random() * 70 : 0,
      ease: easeInCubic,
      onUpdate: (t) => {
        const mt = 1 - t;
        drop.x = mt * mt * fromX + 2 * mt * t * cx + t * t * target.x;
        drop.y = mt * mt * fromY + 2 * mt * t * cy + t * t * target.y;
        drop.scale.set(1 - 0.4 * t);
        drop.alpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
      },
      onDone: () => {
        this.releaseFx(drop);
        if (!decorative) this.spawnSplash(target.x, target.y);
        onLand?.();
      },
    });
  }

  /** Small expanding ripple ring where a scoring droplet hits the bar. */
  private spawnSplash(x: number, y: number) {
    const ring = this.acquireFx();
    ring.position.set(x, y);
    this.addTween({
      duration: 320,
      ease: easeOutCubic,
      onUpdate: (t) => {
        ring.clear();
        ring.circle(0, 0, 2 + t * 9).stroke({
          color: WATER_HIGHLIGHT,
          alpha: (1 - t) * 0.7,
          width: 2,
        });
      },
      onDone: () => this.releaseFx(ring),
    });
  }

  private showCombo(combo: number, grid: GridInfo) {
    const cellFull = grid.cellSize + grid.gap;
    const cx = grid.boardOffsetX + (grid.cols * cellFull) / 2;
    const cy = grid.boardOffsetY + (grid.rows * cellFull) / 2;

    const label = new Text({
      text: `COMBO ×${combo}`,
      style: new TextStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 30,
        fontWeight: "800",
        fill: "#ffe08a",
        stroke: { color: "#5a3a00", width: 5 },
        dropShadow: {
          alpha: 0.5,
          angle: Math.PI / 2,
          blur: 4,
          color: "#000000",
          distance: 2,
        },
      }),
    });
    label.anchor.set(0.5);
    label.position.set(cx, cy);
    // Always render above the pop-cubes / droplets of the same clear.
    label.zIndex = 1000;
    this.addChild(label);

    this.addTween({
      duration: 950,
      ease: easeOutCubic,
      onUpdate: (t) => {
        const pop = t < 0.3 ? easeOutBack(t / 0.3) : 1;
        label.scale.set(0.6 + 0.5 * pop);
        label.y = cy - t * 44;
        label.alpha = t > 0.6 ? Math.max(0, 1 - (t - 0.6) / 0.4) : 1;
      },
      onDone: () => label.destroy(),
    });
  }

  override destroy(options?: Parameters<typeof Container.prototype.destroy>[0]) {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.tweens = [];
    // Pooled (detached) graphics aren't children, so destroy them explicitly.
    for (const g of this.fxPool) g.destroy();
    this.fxPool = [];
    super.destroy(options);
  }
}
