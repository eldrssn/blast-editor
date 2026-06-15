import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { getCubeContext } from "./cubeContext";
import { ClearedCellCoord } from "@/entities/game/model/types";

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

    const cellFull = grid.cellSize + grid.gap;
    const size = grid.cellSize;

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
      const cx = grid.boardOffsetX + cell.col * cellFull + size / 2;
      const cy = grid.boardOffsetY + cell.row * cellFull + size / 2;
      const color = cell.color ?? "#5eb1ff";
      const stagger = i * 14;

      const cube = new Graphics(getCubeContext(color, size));
      cube.pivot.set(size / 2, size / 2);
      cube.position.set(cx, cy);
      this.addChild(cube);

      this.addTween({
        duration: 300,
        delay: stagger,
        ease: easeInCubic,
        onUpdate: (t) => {
          // Pop up to 1.25x in the first third, then collapse to 0.
          const scale = t < 0.35 ? 1 + (t / 0.35) * 0.25 : 1.25 * (1 - (t - 0.35) / 0.65);
          cube.scale.set(Math.max(scale, 0));
          cube.alpha = 1 - Math.max(0, (t - 0.4) / 0.6);
          cube.rotation = t * 0.35;
        },
        onDone: () => {
          cube.destroy();
          // Scoring droplet (drives accounting).
          this.spawnDroplet(cx, cy, target, onLand, false);
          // A few decorative droplets for splashiness (capped for big clears).
          for (let d = 0; d < decorativePerCell; d++) {
            this.spawnDroplet(cx, cy, target, undefined, true);
          }
        },
      });
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
