import { Container, FederatedPointerEvent } from "pixi.js";
import { HammerArea } from "@/entities/game/model/types";
import { GridInfoProvider } from "./FigureLayer";

type HammerControllerOptions = {
  /** Event target + coordinate space for the selection pointer (the scene). */
  target: Container;
  /** Current board geometry. */
  getGridInfo: GridInfoProvider;
  /** Configured selection size (clamped to the board internally). */
  getAreaSize: () => { rows: number; cols: number };
  /** Push the current selection to the board overlay (null clears it). */
  showArea: (area: HammerArea | null) => void;
  /** Enable/disable figure dragging while selecting. */
  setFiguresInteractive: (interactive: boolean) => void;
  /** Apply the hammer at the confirmed area (scene owns the game effect). */
  onConfirm: (area: HammerArea) => void;
};

/**
 * Owns the hammer-booster *selection input*: a movable frame the player drags
 * over the board, plus enter/cancel/confirm transitions. The actual block
 * removal + scoring stays in GameScene (via `onConfirm`) so this controller is
 * purely about pointer handling and the selection overlay.
 */
export class HammerController {
  private active = false;
  private area: HammerArea | null = null;
  private pointerDown = false;

  constructor(private readonly opts: HammerControllerOptions) {}

  get isActive() {
    return this.active;
  }

  /** Enter selection mode: disable figures, attach listeners, seed the frame. */
  enter() {
    if (this.active) return;
    this.active = true;
    this.opts.setFiguresInteractive(false);

    const { target } = this.opts;
    target.on("globalpointermove", this.onMove);
    target.on("pointerdown", this.onDown);
    target.on("pointerup", this.onUp);
    target.on("pointerupoutside", this.onUp);

    // Seed the frame at the board centre so something is visible immediately.
    const info = this.opts.getGridInfo();
    const cellFull = info.cellSize + info.gap;
    const cx = info.boardOffsetX + (info.cols * cellFull) / 2;
    const cy = info.boardOffsetY + (info.rows * cellFull) / 2;
    this.updateArea(cx, cy);
  }

  /** Cancel selection without applying — figures become interactive again. */
  cancel() {
    if (!this.active) return;
    this.teardown();
    this.opts.setFiguresInteractive(true);
  }

  /** Confirm the currently selected area and hand execution to the scene. */
  confirm() {
    if (!this.active || !this.area) return false;
    const area = this.area;
    this.teardown();
    this.opts.onConfirm(area);
    return true;
  }

  /** Remove listeners + overlay and clear the active flag (keeps figures off). */
  private teardown() {
    const { target } = this.opts;
    target.off("globalpointermove", this.onMove);
    target.off("pointerdown", this.onDown);
    target.off("pointerup", this.onUp);
    target.off("pointerupoutside", this.onUp);
    this.opts.showArea(null);
    this.area = null;
    this.active = false;
    this.pointerDown = false;
  }

  private onMove = (e: FederatedPointerEvent) => {
    if (!this.active || !this.pointerDown) return;
    const p = this.opts.target.toLocal(e.global);
    this.updateArea(p.x, p.y);
  };

  private onDown = (e: FederatedPointerEvent) => {
    if (!this.active) return;
    this.pointerDown = true;
    const p = this.opts.target.toLocal(e.global);
    this.updateArea(p.x, p.y);
  };

  private onUp = () => {
    if (!this.active) return;
    this.pointerDown = false;
  };

  /** Position the frame centred on the given scene-local point, clamped. */
  private updateArea(localX: number, localY: number) {
    const info = this.opts.getGridInfo();
    if (info.cellSize <= 0) return;
    const cellFull = info.cellSize + info.gap;

    const wanted = this.opts.getAreaSize();
    const areaRows = Math.min(wanted.rows, info.rows);
    const areaCols = Math.min(wanted.cols, info.cols);

    const pointerCol = Math.floor((localX - info.boardOffsetX) / cellFull);
    const pointerRow = Math.floor((localY - info.boardOffsetY) / cellFull);

    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    const startCol = clamp(pointerCol - Math.floor(areaCols / 2), info.cols - areaCols);
    const startRow = clamp(pointerRow - Math.floor(areaRows / 2), info.rows - areaRows);

    this.area = {
      startRow,
      startCol,
      endRow: startRow + areaRows - 1,
      endCol: startCol + areaCols - 1,
    };
    this.opts.showArea(this.area);
  }
}
