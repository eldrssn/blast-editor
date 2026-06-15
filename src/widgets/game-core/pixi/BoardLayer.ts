import { Container, Graphics } from "pixi.js";
import { BoardCell, FigureInstance, GridPosition, HammerArea } from "@/entities/game/model/types";
import { CORNER_RADIUS } from "./cube";
import { getCubeContext } from "./cubeContext";

/** Gap between cells */
const GAP = 2;

export class BoardLayer extends Container {
  /** Empty-cell insets (cheap, redrawn each pass). */
  private gridGraphics: Graphics;
  /** Pooled cube graphics for filled cells (share cached contexts). */
  private cubeLayer: Container;
  private cubePool: Graphics[] = [];
  /** Debug grid overlay (cell boundaries), toggled by visual.showDebugGrid. */
  private debugGraphics: Graphics;
  private showDebugGrid: boolean = false;
  private highlightGraphics: Graphics;
  private cellSize: number = 0;
  private boardOffsetX: number = 0;
  private boardOffsetY: number = 0;
  private rows: number = 8;
  private cols: number = 8;
  /** Last board drawn — used by the hammer overlay to know which cells are filled. */
  private lastBoard: BoardCell[][] = [];
  /** Active hammer selection + animation phase for its pulsing highlight. */
  private currentHammerArea: HammerArea | null = null;
  private hammerPhase: number = 0;

  constructor() {
    super();
    this.gridGraphics = new Graphics();
    this.addChild(this.gridGraphics);

    // Cubes sit above the empty-cell insets and below the highlight overlay.
    this.cubeLayer = new Container();
    this.addChild(this.cubeLayer);

    // Debug grid sits above the cubes so cell boundaries stay visible.
    this.debugGraphics = new Graphics();
    this.debugGraphics.zIndex = 5;
    this.addChild(this.debugGraphics);

    this.highlightGraphics = new Graphics();
    this.highlightGraphics.zIndex = 10;
    this.addChild(this.highlightGraphics);
  }

  /**
   * Lay out and draw the board based on current board state.
   * @param board   Current board cell data
   * @param sceneW  Total scene width (logical)
   * @param sceneH  Total scene height (logical)
   * @param topOffset Pixels already consumed by HUD
   * @param bottomOffset Pixels reserved for figures at the bottom
   */
  draw(
    board: BoardCell[][],
    sceneW: number,
    sceneH: number,
    topOffset: number,
    bottomOffset: number
  ) {
    this.lastBoard = board;
    this.rows = board.length;
    this.cols = board[0]?.length || 8;

    const availableW = sceneW - 16; // 8px side padding each
    const availableH = sceneH - topOffset - bottomOffset - 16;
    const maxCellW = Math.floor(availableW / this.cols);
    const maxCellH = Math.floor(availableH / this.rows);
    const cellFull = Math.min(maxCellW, maxCellH);
    this.cellSize = cellFull - GAP;

    const boardW = cellFull * this.cols;
    const boardH = cellFull * this.rows;
    this.boardOffsetX = (sceneW - boardW) / 2;
    this.boardOffsetY = topOffset + (availableH - boardH) / 2;

    this.gridGraphics.clear();

    // Filled cells reuse pooled cube graphics backed by cached contexts, so the
    // (relatively expensive) cube geometry is tessellated once per color/size
    // and only the cheap empty-cell insets are re-drawn each pass.
    let cubeIndex = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const px = this.boardOffsetX + c * cellFull;
        const py = this.boardOffsetY + r * cellFull;
        const cell = board[r]?.[c];

        if (cell?.filled && cell.color) {
          const cube = this.acquireCube(cubeIndex++);
          cube.context = getCubeContext(cell.color, this.cellSize);
          cube.position.set(px, py);
          cube.visible = true;
        } else {
          // Empty cell – subtle inset tile
          this.gridGraphics
            .roundRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2, 4)
            .fill({ color: 0x000000, alpha: 0.2 });
          this.gridGraphics
            .roundRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2, 4)
            .stroke({ color: 0xffffff, alpha: 0.05, width: 1 });
        }
      }
    }

    // Hide any pooled cubes left over from a fuller board.
    for (let i = cubeIndex; i < this.cubePool.length; i++) {
      this.cubePool[i].visible = false;
    }

    this.renderDebugGrid();

    // Clear any leftover highlight
    this.highlightGraphics.clear();
  }

  /** Toggle the debug grid overlay and redraw it with current geometry. */
  setShowDebugGrid(value: boolean) {
    if (this.showDebugGrid === value) return;
    this.showDebugGrid = value;
    this.renderDebugGrid();
  }

  /** Draw cell-boundary lines + an outer frame across the board. */
  private renderDebugGrid() {
    this.debugGraphics.clear();
    if (!this.showDebugGrid || this.cellSize <= 0) return;

    const cellFull = this.cellSize + GAP;
    const boardW = cellFull * this.cols;
    const boardH = cellFull * this.rows;
    const x0 = this.boardOffsetX;
    const y0 = this.boardOffsetY;

    // Vertical + horizontal cell-boundary lines.
    for (let c = 0; c <= this.cols; c++) {
      const x = x0 + c * cellFull;
      this.debugGraphics.moveTo(x, y0).lineTo(x, y0 + boardH);
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = y0 + r * cellFull;
      this.debugGraphics.moveTo(x0, y).lineTo(x0 + boardW, y);
    }
    this.debugGraphics.stroke({ color: 0xff00ff, alpha: 0.5, width: 1 });

    // Brighter outer frame.
    this.debugGraphics
      .rect(x0, y0, boardW, boardH)
      .stroke({ color: 0xff00ff, alpha: 0.9, width: 2 });
  }

  /** Get (or lazily create) a pooled cube graphics by index. */
  private acquireCube(index: number): Graphics {
    let cube = this.cubePool[index];
    if (!cube) {
      cube = new Graphics();
      this.cubePool[index] = cube;
      this.cubeLayer.addChild(cube);
    }
    return cube;
  }

  /**
   * Show placement highlight on the board.
   * @param gridPos   The top-left grid position for placement
   * @param figure    The figure being placed
   * @param valid     Whether the placement is valid
   */
  showHighlight(gridPos: GridPosition | null, figure: FigureInstance | null, valid: boolean) {
    this.highlightGraphics.clear();

    if (!gridPos || !figure) return;

    const cellFull = this.cellSize + GAP;

    for (const cell of figure.cells) {
      const r = gridPos.row + cell.row;
      const c = gridPos.col + cell.col;

      // Only show highlights for cells within board boundaries
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;

      const px = this.boardOffsetX + c * cellFull;
      const py = this.boardOffsetY + r * cellFull;

      if (valid) {
        // Valid: greenish glow with the figure's color tint
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .fill({ color: 0x4ade80, alpha: 0.35 });
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .stroke({ color: 0x4ade80, alpha: 0.6, width: 2 });
      } else {
        // Invalid: reddish
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .fill({ color: 0xef4444, alpha: 0.25 });
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .stroke({ color: 0xef4444, alpha: 0.5, width: 2 });
      }
    }
  }

  /**
   * Draw the hammer booster selection: a 4×4 frame plus per-cell highlights.
   * Filled cells inside the area are tinted red (they will be removed); empty
   * cells get a faint amber tint. Pass `null` to clear the overlay.
   * Reuses the same highlight graphics as placement (the two are never active
   * at the same time — figures are disabled while the hammer is selecting).
   */
  showHammerArea(area: HammerArea | null) {
    this.currentHammerArea = area;
    if (!area) {
      this.hammerPhase = 0;
      this.highlightGraphics.clear();
      return;
    }
    this.renderHammerArea();
  }

  /**
   * Advance + redraw the hammer overlay pulse. Called from the GameScene ticker
   * while a hammer selection is active; no-op otherwise.
   */
  tickHammer(dtMs: number) {
    if (!this.currentHammerArea) return;
    this.hammerPhase += dtMs;
    this.renderHammerArea();
  }

  private renderHammerArea() {
    const area = this.currentHammerArea;
    this.highlightGraphics.clear();
    if (!area) return;

    const cellFull = this.cellSize + GAP;
    // Pulse oscillates ~0..1 for the filled-cell glow + frame.
    const pulse = 0.5 + 0.5 * Math.sin(this.hammerPhase * 0.006);

    for (let r = area.startRow; r <= area.endRow; r++) {
      for (let c = area.startCol; c <= area.endCol; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        const px = this.boardOffsetX + c * cellFull;
        const py = this.boardOffsetY + r * cellFull;
        const filled = this.lastBoard[r]?.[c]?.filled ?? false;

        if (filled) {
          this.highlightGraphics
            .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
            .fill({ color: 0xef4444, alpha: 0.35 + 0.25 * pulse });
          this.highlightGraphics
            .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
            .stroke({ color: 0xff6b6b, alpha: 0.9, width: 2 });
        } else {
          this.highlightGraphics
            .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
            .fill({ color: 0xffd54a, alpha: 0.1 + 0.06 * pulse });
        }
      }
    }

    // Outer frame — pulsing glow ring plus a solid inner frame.
    const fx = this.boardOffsetX + area.startCol * cellFull;
    const fy = this.boardOffsetY + area.startRow * cellFull;
    const fw = (area.endCol - area.startCol + 1) * cellFull - GAP;
    const fh = (area.endRow - area.startRow + 1) * cellFull - GAP;
    this.highlightGraphics
      .roundRect(fx - 4 - 2 * pulse, fy - 4 - 2 * pulse, fw + 8 + 4 * pulse, fh + 8 + 4 * pulse, 10)
      .stroke({ color: 0xffd54a, alpha: 0.25 + 0.35 * pulse, width: 3 });
    this.highlightGraphics
      .roundRect(fx - 2, fy - 2, fw + 4, fh + 4, 8)
      .stroke({ color: 0xffe9a6, alpha: 0.95, width: 3 });
  }

  /** Returns grid geometry so FigureLayer / GameScene can query it */
  getGridInfo() {
    return {
      cellSize: this.cellSize,
      boardOffsetX: this.boardOffsetX,
      boardOffsetY: this.boardOffsetY,
      rows: this.rows,
      cols: this.cols,
      gap: GAP,
    };
  }
}
