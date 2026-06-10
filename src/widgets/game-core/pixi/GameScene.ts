import { Container, Graphics, Ticker, Rectangle, FederatedPointerEvent } from "pixi.js";
import {
  LevelConfig,
  BoardCell,
  FigureInstance,
  GameStatus,
  HammerArea,
} from "@/entities/game/model/types";
import { HudLayer } from "./HudLayer";
import { BoardLayer } from "./BoardLayer";
import { FigureLayer, FigurePlacementEvent } from "./FigureLayer";
import { EffectsLayer } from "./EffectsLayer";
import { canPlaceFigure, placeFigure, findCompletedLines, clearCompletedLines, canPlaceAnyFigure } from "@/entities/game/lib/board";
import { calculateScore, checkWinCondition } from "@/entities/game/lib/scoring";
import { generateFigureSet } from "@/entities/game/lib/figures";
import { applyCollectAll, applyHammer } from "@/entities/game/lib/boosters";
import { soundManager } from "@/shared/lib/sound";

/** Wood-tone palettes keyed by LevelConfig.visual.backgroundId. */
const WOOD_THEMES: Record<string, { base: number; plankA: number; plankB: number; seam: number }> = {
  wood_classic: { base: 0x3a2412, plankA: 0x4a2f17, plankB: 0x402812, seam: 0x24150a },
  wood_dark: { base: 0x1a0f07, plankA: 0x2b1a0d, plankB: 0x231408, seam: 0x130b05 },
  wood_royal: { base: 0x3a1810, plankA: 0x52221a, plankB: 0x451a13, seam: 0x280f0a },
};

/** Logical canvas dimensions (always rendered at this internal resolution) */
export const SCENE_W = 450;
export const SCENE_H = 800;

const HUD_HEIGHT = 72; // px reserved at top for score bar + title

/** Callback type for GameScene events emitted to the store/React layer */
export type GameSceneCallbacks = {
  onBoardUpdate: (board: BoardCell[][]) => void;
  onFiguresUpdate: (figures: FigureInstance[]) => void;
  onScoreUpdate: (score: number) => void;
  onStatusUpdate: (status: GameStatus) => void;
  /**
   * Fired when a hammer selection resolves. `consumed` is true only when the
   * hammer actually removed blocks (so the caller spends a charge); a confirm
   * over an empty area resolves with `false` and no charge is spent.
   */
  onHammerComplete: (consumed: boolean) => void;
};

export class GameScene extends Container {
  private background: Graphics;
  readonly hudLayer: HudLayer;
  readonly boardLayer: BoardLayer;
  readonly figureLayer: FigureLayer;
  readonly effectsLayer: EffectsLayer;

  private config: LevelConfig;
  private board: BoardCell[][] = [];
  private figures: FigureInstance[] = [];
  private score: number = 0;
  private isMultiplierActive: boolean = false;

  /** Hammer booster selection state */
  private hammerMode: boolean = false;
  private hammerArea: HammerArea | null = null;

  /** Ticker for levitation animation */
  private ticker: Ticker;

  /** External callbacks to notify React/store of state changes */
  callbacks: GameSceneCallbacks | null = null;

  /** Cached from config.visual — drives animations + sound gating. */
  private effectsEnabled: boolean = true;

  constructor(config: LevelConfig) {
    super();
    this.config = config;
    this.effectsEnabled = config.visual?.effectsEnabled !== false;
    soundManager.setEnabled(config.visual?.soundEnabled !== false);
    this.sortableChildren = true;
    this.eventMode = "static";
    // Make the whole scene a hit target so the hammer booster can track pointer
    // moves / taps over empty board cells (figures are tested first, so normal
    // drag-and-drop is unaffected).
    this.hitArea = new Rectangle(0, 0, SCENE_W, SCENE_H);

    // --- Background ---
    this.background = new Graphics();
    this.background.zIndex = 0;
    this.drawBackground();
    this.addChild(this.background);

    // --- Layers ---
    this.boardLayer = new BoardLayer();
    this.boardLayer.zIndex = 1;
    this.addChild(this.boardLayer);

    this.figureLayer = new FigureLayer();
    this.figureLayer.zIndex = 2;
    this.addChild(this.figureLayer);

    this.hudLayer = new HudLayer();
    this.hudLayer.zIndex = 3;
    this.addChild(this.hudLayer);

    this.effectsLayer = new EffectsLayer();
    this.addChild(this.effectsLayer);

    // Propagate the effects toggle to the layers that own animations.
    this.figureLayer.effectsEnabled = this.effectsEnabled;
    this.effectsLayer.effectsEnabled = this.effectsEnabled;

    // --- Wire up FigureLayer callbacks ---
    this.figureLayer.getGridInfo = () => this.boardLayer.getGridInfo();
    this.figureLayer.canPlaceAt = (figure, row, col) =>
      canPlaceFigure(this.board, figure, row, col);
    this.figureLayer.onHighlightUpdate = (gridPos, figure, valid) =>
      this.boardLayer.showHighlight(gridPos, figure, valid);
    this.figureLayer.onPlacementAttempt = (event) =>
      this.handlePlacementAttempt(event);
    this.figureLayer.onPlacementSuccess = () =>
      this.handlePlacementSuccess();

    // --- Ticker for levitation + HUD animation ---
    this.ticker = new Ticker();
    this.ticker.add((ticker) => {
      this.figureLayer.updateLevitation(ticker.deltaMS);
      this.hudLayer.tick(ticker.deltaMS);
      this.boardLayer.tickHammer(ticker.deltaMS);
    });
    this.ticker.start();
  }

  private drawBackground() {
    this.background.clear();
    const theme = WOOD_THEMES[this.config.visual?.backgroundId] ?? WOOD_THEMES.wood_classic;

    // Base fill.
    this.background.rect(0, 0, SCENE_W, SCENE_H).fill({ color: theme.base });

    // Horizontal wooden planks with a darker seam between each.
    const plankCount = 7;
    const plankH = SCENE_H / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const y = i * plankH;
      this.background
        .rect(0, y, SCENE_W, plankH)
        .fill({ color: i % 2 === 0 ? theme.plankA : theme.plankB });
      // Seam line at the top of each plank.
      this.background.rect(0, y, SCENE_W, 2).fill({ color: theme.seam, alpha: 0.7 });

      // Subtle grain streaks along the plank.
      for (let s = 0; s < 3; s++) {
        const gy = y + plankH * (0.25 + s * 0.25);
        this.background
          .rect(0, gy, SCENE_W, 1)
          .fill({ color: theme.seam, alpha: 0.12 });
      }
    }

    // Soft vignette: darker top and bottom edges for depth.
    this.background.rect(0, 0, SCENE_W, 80).fill({ color: 0x000000, alpha: 0.22 });
    this.background.rect(0, SCENE_H - 120, SCENE_W, 120).fill({ color: 0x000000, alpha: 0.25 });
    this.background.rect(0, 0, SCENE_W, SCENE_H).fill({ color: 0x000000, alpha: 0.08 });
  }

  /**
   * Full render pass: update HUD, board and figures.
   * Called externally when state changes.
   */
  renderState(board: BoardCell[][], figures: FigureInstance[], score: number, isMultiplierActive?: boolean) {
    this.board = board;
    this.figures = figures;
    this.score = score;
    if (isMultiplierActive !== undefined) {
      this.isMultiplierActive = isMultiplierActive;
    }

    // HUD
    this.hudLayer.update(score, this.config.targetScore, this.config.title, SCENE_W, this.isMultiplierActive);

    // Board
    this.boardLayer.draw(board, SCENE_W, SCENE_H, HUD_HEIGHT, FigureLayer.slotHeight + 8);

    // Figures
    const { cellSize } = this.boardLayer.getGridInfo();
    this.figureLayer.draw(figures, SCENE_W, SCENE_H, cellSize);
  }

  // ─── Placement Logic ──────────────────────────────────────────

  /**
   * Called when a figure is dropped on a valid grid position.
   * Returns true if the placement was accepted.
   */
  private handlePlacementAttempt(event: FigurePlacementEvent): boolean {
    const { figure, gridPosition } = event;

    // Final validation
    if (!canPlaceFigure(this.board, figure, gridPosition.row, gridPosition.col)) {
      return false;
    }

    // Place the figure on the board
    this.board = placeFigure(this.board, figure, gridPosition.row, gridPosition.col);

    // Mark figure as placed
    const updatedFigures = this.figures.map((f) =>
      f.uid === figure.uid ? { ...f, placed: true } : f
    );
    this.figures = updatedFigures;

    // Update score display (board changed, score may change after line clear)
    this.callbacks?.onBoardUpdate(this.board);
    this.callbacks?.onFiguresUpdate(this.figures);

    return true;
  }

  /**
   * Called after the bounce animation completes for a successful placement.
   * Detects completed lines, plays the clear + water animation, awards score
   * when the water reaches the bar, then runs win/regenerate/lose checks.
   */
  private handlePlacementSuccess() {
    const completedLines = findCompletedLines(this.board);

    // No lines cleared — skip animation, run post-move checks immediately.
    if (completedLines.length === 0) {
      this.afterClear();
      return;
    }

    soundManager.play("lineClear");

    const result = clearCompletedLines(this.board, completedLines);
    const points = calculateScore({
      clearedCellsCount: result.clearedCellsCount,
      clearedLinesCount: result.clearedLinesCount,
      isMultiplierActive: this.isMultiplierActive,
    });

    // Update the logical board now (cleared cells go empty); the popping cubes
    // are drawn on top by the EffectsLayer so the removal still looks animated.
    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    const target = this.hudLayer.getWaterTargetPoint();
    this.effectsLayer.playLineClear(
      result.clearedCellCoords,
      this.boardLayer.getGridInfo(),
      result.clearedLinesCount,
      target,
      {
        // Award the score the instant the first water droplet lands.
        onScoreArrive: () => {
          this.score += points;
          this.hudLayer.update(this.score, this.config.targetScore, this.config.title, SCENE_W, this.isMultiplierActive);
          this.hudLayer.pulse();
          this.callbacks?.onScoreUpdate(this.score);
        },
        // Run win / regenerate / lose checks only after the animation settles.
        onComplete: () => {
          this.afterClear();
        },
      }
    );
  }

  /**
   * Post-move resolution: win check, figure regeneration, lose check.
   * Shared by the cleared-line and no-clear paths.
   */
  private afterClear() {
    // 1. Win
    if (checkWinCondition(this.score, this.config.targetScore)) {
      this.callbacks?.onStatusUpdate("won");
      this.renderState(this.board, this.figures, this.score);
      return;
    }

    // 2. Regenerate the set once all 3 figures are placed
    const allPlaced = this.figures.every((f) => f.placed);
    if (allPlaced) {
      this.figures = generateFigureSet(this.config);
      this.callbacks?.onFiguresUpdate(this.figures);
    }

    // 3. Lose condition (no available move). Offer protection from loss when
    // enabled; otherwise go straight to the lose state.
    if (!canPlaceAnyFigure(this.board, this.figures)) {
      const protectionEnabled = this.config.protectionFromLoss?.enabled ?? false;
      this.callbacks?.onStatusUpdate(protectionEnabled ? "protection_from_loss" : "lost");
      this.renderState(this.board, this.figures, this.score);
      return;
    }

    // 4. Re-render
    this.renderState(this.board, this.figures, this.score);
  }

  // ─── Boosters ─────────────────────────────────────────────────

  /**
   * Collect All booster: clears every filled cell and awards 1 point per cell
   * (doubled while the multiplier is active), animating water into the bar.
   * Returns true if any cells were cleared (so the caller spends a charge);
   * returns false on an empty board — nothing happens and no charge is spent.
   */
  collectAll(): boolean {
    if (this.hammerMode) return false;
    const hasFilled = this.board.some((row) => row.some((cell) => cell.filled));
    if (!hasFilled) return false;

    const result = applyCollectAll(this.board);
    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    const points = calculateScore({
      clearedCellsCount: result.clearedCellsCount,
      clearedLinesCount: 0,
      isMultiplierActive: this.isMultiplierActive,
    });

    const target = this.hudLayer.getWaterTargetPoint();
    this.effectsLayer.playLineClear(
      result.clearedCellCoords,
      this.boardLayer.getGridInfo(),
      1, // no combo label for boosters
      target,
      {
        onScoreArrive: () => {
          this.score += points;
          this.hudLayer.update(this.score, this.config.targetScore, this.config.title, SCENE_W, this.isMultiplierActive);
          this.hudLayer.pulse();
          this.callbacks?.onScoreUpdate(this.score);
        },
        onComplete: () => {
          this.afterClear();
        },
      }
    );

    return true;
  }

  /**
   * Enter the hammer selection mode: a movable 4×4 frame the player positions
   * over the board. Figures are disabled so pointer moves/taps drive the frame.
   */
  enterHammerMode() {
    if (this.hammerMode) return;
    this.hammerMode = true;
    this.figureLayer.eventMode = "none";

    this.on("globalpointermove", this.onHammerMove);
    this.on("pointerdown", this.onHammerDown);
    this.on("pointerup", this.onHammerUp);
    this.on("pointerupoutside", this.onHammerUp);

    // Seed the frame at the board centre so something is visible immediately.
    const info = this.boardLayer.getGridInfo();
    const cellFull = info.cellSize + info.gap;
    const cx = info.boardOffsetX + (info.cols * cellFull) / 2;
    const cy = info.boardOffsetY + (info.rows * cellFull) / 2;
    this.updateHammerArea(cx, cy);
  }

  /** Cancel hammer mode without applying it — no charge is spent. */
  exitHammerMode() {
    if (!this.hammerMode) return;
    this.teardownHammer();
    this.figureLayer.eventMode = "static";
  }

  /** Remove hammer listeners + overlay and clear the mode flag. */
  private teardownHammer() {
    this.off("globalpointermove", this.onHammerMove);
    this.off("pointerdown", this.onHammerDown);
    this.off("pointerup", this.onHammerUp);
    this.off("pointerupoutside", this.onHammerUp);
    this.boardLayer.showHammerArea(null);
    this.hammerArea = null;
    this.hammerMode = false;
  }

  private onHammerMove = (e: FederatedPointerEvent) => {
    if (!this.hammerMode) return;
    const p = this.toLocal(e.global);
    this.updateHammerArea(p.x, p.y);
  };

  private onHammerDown = (e: FederatedPointerEvent) => {
    if (!this.hammerMode) return;
    const p = this.toLocal(e.global);
    this.updateHammerArea(p.x, p.y);
  };

  private onHammerUp = () => {
    if (!this.hammerMode) return;
    this.confirmHammer();
  };

  /** Position the 4×4 frame centred on the given scene-local point, clamped. */
  private updateHammerArea(localX: number, localY: number) {
    const info = this.boardLayer.getGridInfo();
    if (info.cellSize <= 0) return;
    const cellFull = info.cellSize + info.gap;

    const areaRows = Math.min(this.config.boosters?.hammer?.areaRows ?? 4, info.rows);
    const areaCols = Math.min(this.config.boosters?.hammer?.areaCols ?? 4, info.cols);

    const pointerCol = Math.floor((localX - info.boardOffsetX) / cellFull);
    const pointerRow = Math.floor((localY - info.boardOffsetY) / cellFull);

    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
    const startCol = clamp(pointerCol - Math.floor(areaCols / 2), info.cols - areaCols);
    const startRow = clamp(pointerRow - Math.floor(areaRows / 2), info.rows - areaRows);

    this.hammerArea = {
      startRow,
      startCol,
      endRow: startRow + areaRows - 1,
      endCol: startCol + areaCols - 1,
    };
    this.boardLayer.showHammerArea(this.hammerArea);
  }

  /**
   * Apply the hammer at the current frame: remove filled cells inside it and
   * award score. A confirm over an area with no filled cells resolves without
   * spending a charge.
   */
  private confirmHammer() {
    if (!this.hammerMode || !this.hammerArea) return;
    const area = this.hammerArea;
    const result = applyHammer(this.board, area);

    this.teardownHammer();

    if (result.clearedCellsCount === 0) {
      this.figureLayer.eventMode = "static";
      this.renderState(this.board, this.figures, this.score);
      this.callbacks?.onHammerComplete(false);
      return;
    }

    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    const points = calculateScore({
      clearedCellsCount: result.clearedCellsCount,
      clearedLinesCount: 0,
      isMultiplierActive: this.isMultiplierActive,
    });

    const target = this.hudLayer.getWaterTargetPoint();
    this.effectsLayer.playLineClear(
      result.clearedCellCoords,
      this.boardLayer.getGridInfo(),
      1,
      target,
      {
        onScoreArrive: () => {
          this.score += points;
          this.hudLayer.update(this.score, this.config.targetScore, this.config.title, SCENE_W, this.isMultiplierActive);
          this.hudLayer.pulse();
          this.callbacks?.onScoreUpdate(this.score);
        },
        onComplete: () => {
          this.figureLayer.eventMode = "static";
          this.callbacks?.onHammerComplete(true);
          this.afterClear();
        },
      }
    );
  }

  /** Clean up the ticker on destroy */
  override destroy(options?: Parameters<typeof Container.prototype.destroy>[0]) {
    this.ticker.stop();
    this.ticker.destroy();
    super.destroy(options);
  }
}
