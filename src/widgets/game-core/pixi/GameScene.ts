import { Container, Ticker, Rectangle } from "pixi.js";
import {
  LevelConfig,
  BoardCell,
  FigureInstance,
  GameStatus,
  HammerArea,
  ClearedCellCoord,
} from "@/entities/game/model/types";
import { HudLayer } from "./HudLayer";
import { BoardLayer } from "./BoardLayer";
import { BackgroundLayer } from "./BackgroundLayer";
import { FigureLayer, FigurePlacementEvent } from "./FigureLayer";
import { EffectsLayer } from "./EffectsLayer";
import { HammerController } from "./HammerController";
import { canPlaceFigure, placeFigure, findCompletedLines, clearCompletedLines } from "@/entities/game/lib/board";
import { calculateScore } from "@/entities/game/lib/scoring";
import { resolvePostMove } from "@/entities/game/lib/gameFlow";
import { applyCollectAll, applyHammer } from "@/entities/game/lib/boosters";
import { soundManager } from "@/shared/lib/sound";

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
  private background: BackgroundLayer;
  readonly hudLayer: HudLayer;
  readonly boardLayer: BoardLayer;
  readonly figureLayer: FigureLayer;
  readonly effectsLayer: EffectsLayer;

  private config: LevelConfig;
  private board: BoardCell[][] = [];
  private figures: FigureInstance[] = [];
  private score: number = 0;
  private isMultiplierActive: boolean = false;
  /** Configured multiplier value (from config.boosters.multiplier), default 2. */
  private multiplierValue: number = 2;

  /** Hammer booster selection input (block removal stays in this scene). */
  private hammer: HammerController;

  /** Ticker for levitation animation */
  private ticker: Ticker;

  /** External callbacks to notify React/store of state changes */
  callbacks: GameSceneCallbacks | null = null;

  constructor(config: LevelConfig) {
    super();
    this.config = config;
    this.multiplierValue = config.boosters?.multiplier?.multiplierValue ?? 2;
    this.sortableChildren = true;
    this.eventMode = "static";
    // Make the whole scene a hit target so the hammer booster can track pointer
    // moves / taps over empty board cells (figures are tested first, so normal
    // drag-and-drop is unaffected).
    this.hitArea = new Rectangle(0, 0, SCENE_W, SCENE_H);

    // --- Background ---
    this.background = new BackgroundLayer();
    this.background.zIndex = 0;
    this.background.draw(config, SCENE_W, SCENE_H);
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

    // --- Hammer booster selection (input only; effect handled below) ---
    this.hammer = new HammerController({
      target: this,
      getGridInfo: () => this.boardLayer.getGridInfo(),
      showArea: (area) => this.boardLayer.showHammerArea(area),
      setFiguresInteractive: (interactive) => {
        this.figureLayer.eventMode = interactive ? "static" : "none";
      },
      onConfirm: (area) => this.applyHammerAt(area),
    });

    // --- Ticker for levitation + HUD animation ---
    this.ticker = new Ticker();
    this.ticker.add((ticker) => {
      this.figureLayer.updateLevitation(ticker.deltaMS);
      this.hudLayer.tick(ticker.deltaMS);
      this.boardLayer.tickHammer(ticker.deltaMS);
    });
    this.ticker.start();
  }

  /**
   * Apply cosmetic / non-structural config changes in place, without rebuilding
   * the scene or restarting the level: background theme, title, target score
   * and the multiplier value. Structural changes (grid, initial board, figures,
   * booster inventory) still go through a full rebuild in the React layer.
   */
  applyVisualConfig(config: LevelConfig) {
    this.config = config;
    this.multiplierValue = config.boosters?.multiplier?.multiplierValue ?? 2;
    this.background.draw(config, SCENE_W, SCENE_H);
    this.renderState(this.board, this.figures, this.score);
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
    this.hudLayer.update(score, this.config.targetScore, this.config.levelId, SCENE_W, this.isMultiplierActive, this.multiplierValue);

    // Board — reserve room below for the figure slots *and* the booster band so
    // the vertical order reads HUD → board → figures → boosters.
    this.boardLayer.setShowDebugGrid(this.config.visual?.showDebugGrid === true);
    this.boardLayer.draw(board, SCENE_W, SCENE_H, HUD_HEIGHT, FigureLayer.slotHeight + FigureLayer.boosterBand + 8);

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

    // Update the logical board now (cleared cells go empty); the popping cubes
    // are drawn on top by the EffectsLayer so the removal still looks animated.
    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    // Combo label reflects the number of simultaneously cleared lines.
    this.awardAndAnimateClear(result, result.clearedLinesCount, () => this.afterClear());
  }

  /**
   * Shared clear→score→water-animation routine used by line clears and both
   * cell-clearing boosters. Computes the score for the cleared cells, flies the
   * water droplets into the bar, awards the score when the first droplet lands,
   * and runs `onComplete` once the animation settles.
   *
   * `comboCount` only drives the combo label (>= 2 shows "COMBO ×n").
   */
  private awardAndAnimateClear(
    result: { clearedCellsCount: number; clearedLinesCount?: number; clearedCellCoords: ClearedCellCoord[] },
    comboCount: number,
    onComplete: () => void
  ) {
    const points = calculateScore({
      clearedCellsCount: result.clearedCellsCount,
      clearedLinesCount: result.clearedLinesCount ?? 0,
      isMultiplierActive: this.isMultiplierActive,
      multiplierValue: this.multiplierValue,
    });

    const target = this.hudLayer.getWaterTargetPoint();
    this.effectsLayer.playLineClear(
      result.clearedCellCoords,
      this.boardLayer.getGridInfo(),
      comboCount,
      target,
      {
        // Award the score the instant the first water droplet lands. Clamp to the
        // target so the counter can never read above the goal (e.g. never "100/60").
        onScoreArrive: () => {
          this.score = Math.min(this.score + points, this.config.targetScore);
          this.hudLayer.update(this.score, this.config.targetScore, this.config.levelId, SCENE_W, this.isMultiplierActive, this.multiplierValue);
          this.hudLayer.pulse();
          this.callbacks?.onScoreUpdate(this.score);
        },
        onComplete,
      }
    );
  }

  /**
   * Post-move resolution: win check, figure regeneration, lose check.
   * Shared by the cleared-line and no-clear paths.
   */
  private afterClear() {
    const result = resolvePostMove(this.board, this.figures, this.score, this.config);

    // Apply a freshly generated set (when the previous one was fully placed).
    if (result.regenerated) {
      this.figures = result.figures;
      this.callbacks?.onFiguresUpdate(this.figures);
    }

    if (result.outcome === "won") {
      this.callbacks?.onStatusUpdate("won");
    } else if (result.outcome === "lost") {
      this.callbacks?.onStatusUpdate("lost");
    } else if (result.outcome === "protection") {
      this.callbacks?.onStatusUpdate("protection_from_loss");
    }

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
    if (this.hammer.isActive) return false;
    const hasFilled = this.board.some((row) => row.some((cell) => cell.filled));
    if (!hasFilled) return false;

    const result = applyCollectAll(this.board);
    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    // comboCount = 1 → no combo label for boosters.
    this.awardAndAnimateClear(result, 1, () => this.afterClear());

    return true;
  }

  /**
   * Protection-from-loss board clear: vanish every filled cell with the cube-pop
   * animation but WITHOUT any water/score (the clear is free in this build). The
   * actual board wipe + figure regeneration is done by the store in `onComplete`;
   * here we only empty the board visually so the popping cubes read on top.
   */
  playBoardClear(onComplete: () => void) {
    const coords: ClearedCellCoord[] = [];
    this.board.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell.filled) coords.push({ row: r, col: c, color: cell.color });
      })
    );

    if (coords.length === 0) {
      onComplete();
      return;
    }

    // Empty the board logically so the underlying cubes disappear; the popping
    // cubes are drawn on top by the EffectsLayer (mirrors the line-clear path).
    this.board = this.board.map((row) =>
      row.map((cell) => ({ ...cell, filled: false, color: undefined, figureId: undefined }))
    );
    this.renderState(this.board, this.figures, this.score);

    this.effectsLayer.playCellsVanish(coords, this.boardLayer.getGridInfo(), onComplete);
  }

  /** Enter the hammer selection mode (delegated to HammerController). */
  enterHammerMode() {
    this.hammer.enter();
  }

  /** Cancel hammer mode without applying it — no charge is spent. */
  exitHammerMode() {
    this.hammer.cancel();
  }

  /** Confirm the current hammer area. Returns false if no selection is active. */
  confirmHammerMode() {
    return this.hammer.confirm();
  }

  /**
   * Apply the hammer at the confirmed area: remove filled cells inside it and
   * award score. A confirm over an area with no filled cells resolves without
   * spending a charge. Figures stay disabled until the effect settles.
   */
  private applyHammerAt(area: HammerArea) {
    const result = applyHammer(this.board, area);

    if (result.clearedCellsCount === 0) {
      this.figureLayer.eventMode = "static";
      this.renderState(this.board, this.figures, this.score);
      this.callbacks?.onHammerComplete(false);
      return;
    }

    this.board = result.board;
    this.callbacks?.onBoardUpdate(this.board);
    this.renderState(this.board, this.figures, this.score);

    this.awardAndAnimateClear(result, 1, () => {
      this.figureLayer.eventMode = "static";
      this.callbacks?.onHammerComplete(true);
      this.afterClear();
    });
  }

  /**
   * Pause/resume the levitation + HUD + hammer ticker. The scene only needs
   * per-frame work while the player is actively playing or selecting a booster;
   * on win/lose/protection overlays nothing animates, so we stop the ticker to
   * spare weak devices the idle JS work. The HUD score is snapped first so the
   * counter never freezes mid-animation.
   */
  setTickerActive(active: boolean) {
    if (active) {
      if (!this.ticker.started) this.ticker.start();
    } else if (this.ticker.started) {
      this.hudLayer.snapScore();
      this.ticker.stop();
    }
  }

  /** Clean up the ticker on destroy */
  override destroy(options?: Parameters<typeof Container.prototype.destroy>[0]) {
    this.ticker.stop();
    this.ticker.destroy();
    super.destroy(options);
  }
}
