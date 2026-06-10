import { Container, Graphics } from "pixi.js";
import { BoardCell, FigureInstance, GridPosition, HammerArea } from "@/entities/game/model/types";

/** Vertical depth offset for pseudo-3D face */
const DEPTH = 5;
/** Corner radius for rounded blocks */
const CORNER_RADIUS = 5;
/** Gap between cells */
const GAP = 2;

/**
 * Draws a pseudo-3D cube inside the given graphics at position (x, y)
 * with dimensions (size x size).
 * The cube has: top face, right dark face, bottom dark face, and a small highlight.
 */
/** Scale a hex color channel-wise. factor<1 darkens, factor>1 lightens (clamped). */
function scaleColor(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const gb = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `#${r.toString(16).padStart(2, "0")}${gb.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

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

export class BoardLayer extends Container {
  private gridGraphics: Graphics;
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

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const px = this.boardOffsetX + c * cellFull;
        const py = this.boardOffsetY + r * cellFull;
        const cell = board[r]?.[c];

        if (cell?.filled && cell.color) {
          drawPseudo3DCube(
            this.gridGraphics,
            px,
            py,
            this.cellSize,
            cell.color
          );
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

    // Clear any leftover highlight
    this.highlightGraphics.clear();
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
