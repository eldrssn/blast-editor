import { Container, Graphics, Sprite } from 'pixi.js';
import {
  BoardCell,
  FigureInstance,
  GridPosition,
  HammerArea,
} from '@/entities/game/model/types';
import { CORNER_RADIUS } from './cube';
import {
  getCubeTexture,
  getGridTexture,
  getStableGridBoxId,
} from '@/shared/lib/gameAssets';

/** Gap between cells */
const GAP = -0.5;

/**
 * Soft contact shadow cast by each filled cell. Offset down-LEFT so blocks read
 * as lit from the top-right; drawn between the socket tiles and the cubes so it
 * only peeks out on the shadow side (the cube hides it on the lit side). The
 * cube .webp itself is untouched.
 */
const CUBE_SHADOW_DX = -4;
const CUBE_SHADOW_DY = 4;
const CUBE_SHADOW_ALPHA = 0.22;
const BOARD_BASE_COLOR = 0x180501;

export class BoardLayer extends Container {
  /** Warm shadow-colored base under the whole board; visible through gaps/corners. */
  private boardBaseGraphics: Graphics;
  /** Decorative empty-cell tiles for the board background. */
  private gridLayer: Container;
  private gridPool: Sprite[] = [];
  /** Directional contact shadows for filled cells, under the cubes. */
  private shadowGraphics: Graphics;
  /** Pooled sprites for filled cells. */
  private cubeLayer: Container;
  private cubePool: Sprite[] = [];
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
    this.boardBaseGraphics = new Graphics();
    this.addChild(this.boardBaseGraphics);

    this.gridLayer = new Container();
    this.addChild(this.gridLayer);

    // Shadows sit above the socket tiles but below the cubes.
    this.shadowGraphics = new Graphics();
    this.addChild(this.shadowGraphics);

    this.cubeLayer = new Container();
    this.addChild(this.cubeLayer);

    this.debugGraphics = new Graphics();
    this.debugGraphics.zIndex = 5;
    this.addChild(this.debugGraphics);

    this.highlightGraphics = new Graphics();
    this.highlightGraphics.zIndex = 10;
    this.addChild(this.highlightGraphics);
  }

  draw(
    board: BoardCell[][],
    sceneW: number,
    sceneH: number,
    topOffset: number,
    bottomOffset: number,
  ) {
    this.lastBoard = board;
    this.rows = board.length;
    this.cols = board[0]?.length || 8;

    const availableW = sceneW - 16;
    const availableH = sceneH - topOffset - bottomOffset - 16;
    const maxCellW = Math.floor(availableW / this.cols);
    const maxCellH = Math.floor(availableH / this.rows);
    const cellFull = Math.min(maxCellW, maxCellH);
    this.cellSize = cellFull - GAP;

    const boardW = cellFull * this.cols;
    const boardH = cellFull * this.rows;
    this.boardOffsetX = (sceneW - boardW) / 2;
    this.boardOffsetY = topOffset + (availableH - boardH) / 2;

    let gridIndex = 0;
    let cubeIndex = 0;
    this.drawBoardBase(boardW, boardH);
    this.shadowGraphics.clear();

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const px = this.boardOffsetX + c * cellFull;
        const py = this.boardOffsetY + r * cellFull;
        const cell = board[r]?.[c];

        // Always draw the cell socket. The cube sprite has glossy rounded
        // (transparent) corners, so the tile must stay visible behind it —
        // otherwise a placed cube looks like it replaces the cell instead of
        // sitting on it.
        const gridTile = this.acquireGridTile(gridIndex++);
        gridTile.texture = getGridTexture(getStableGridBoxId(r, c));
        gridTile.position.set(px, py);
        gridTile.width = this.cellSize;
        gridTile.height = this.cellSize;
        gridTile.alpha = 0.92;
        gridTile.visible = true;

        if (cell?.filled && cell.color) {
          this.drawCubeShadow(px, py);

          const cube = this.acquireCube(cubeIndex++);
          cube.texture = getCubeTexture(cell.color);
          cube.position.set(px, py);
          cube.width = this.cellSize;
          cube.height = this.cellSize;
          cube.visible = true;
        }
      }
    }

    for (let i = gridIndex; i < this.gridPool.length; i++) {
      this.gridPool[i].visible = false;
    }
    for (let i = cubeIndex; i < this.cubePool.length; i++) {
      this.cubePool[i].visible = false;
    }

    this.renderDebugGrid();
    this.highlightGraphics.clear();
  }

  private drawBoardBase(boardW: number, boardH: number) {
    this.boardBaseGraphics.clear();
    this.boardBaseGraphics
      .roundRect(
        this.boardOffsetX,
        this.boardOffsetY,
        boardW,
        boardH,
        CORNER_RADIUS + 2,
      )
      .fill({ color: BOARD_BASE_COLOR, alpha: 0.4 });
  }

  private drawCubeShadow(px: number, py: number) {
    this.shadowGraphics
      .roundRect(
        px + CUBE_SHADOW_DX,
        py + CUBE_SHADOW_DY,
        this.cellSize,
        this.cellSize,
        CORNER_RADIUS,
      )
      .fill({ color: 0x000000, alpha: CUBE_SHADOW_ALPHA });
  }

  setShowDebugGrid(value: boolean) {
    if (this.showDebugGrid === value) return;
    this.showDebugGrid = value;
    this.renderDebugGrid();
  }

  private renderDebugGrid() {
    this.debugGraphics.clear();
    if (!this.showDebugGrid || this.cellSize <= 0) return;

    const cellFull = this.cellSize + GAP;
    const boardW = cellFull * this.cols;
    const boardH = cellFull * this.rows;
    const x0 = this.boardOffsetX;
    const y0 = this.boardOffsetY;

    for (let c = 0; c <= this.cols; c++) {
      const x = x0 + c * cellFull;
      this.debugGraphics.moveTo(x, y0).lineTo(x, y0 + boardH);
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = y0 + r * cellFull;
      this.debugGraphics.moveTo(x0, y).lineTo(x0 + boardW, y);
    }
    this.debugGraphics.stroke({ color: 0xff00ff, alpha: 0.5, width: 1 });

    this.debugGraphics
      .rect(x0, y0, boardW, boardH)
      .stroke({ color: 0xff00ff, alpha: 0.9, width: 2 });
  }

  private acquireGridTile(index: number): Sprite {
    let sprite = this.gridPool[index];
    if (!sprite) {
      sprite = new Sprite();
      this.gridPool[index] = sprite;
      this.gridLayer.addChild(sprite);
    }
    return sprite;
  }

  private acquireCube(index: number): Sprite {
    let sprite = this.cubePool[index];
    if (!sprite) {
      sprite = new Sprite();
      this.cubePool[index] = sprite;
      this.cubeLayer.addChild(sprite);
    }
    return sprite;
  }

  showHighlight(
    gridPos: GridPosition | null,
    figure: FigureInstance | null,
    valid: boolean,
  ) {
    this.highlightGraphics.clear();

    if (!gridPos || !figure) return;

    const cellFull = this.cellSize + GAP;

    for (const cell of figure.cells) {
      const r = gridPos.row + cell.row;
      const c = gridPos.col + cell.col;
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;

      const px = this.boardOffsetX + c * cellFull;
      const py = this.boardOffsetY + r * cellFull;

      if (valid) {
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .fill({ color: 0x4ade80, alpha: 0.35 });
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .stroke({ color: 0x4ade80, alpha: 0.6, width: 2 });
      } else {
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .fill({ color: 0xef4444, alpha: 0.25 });
        this.highlightGraphics
          .roundRect(px, py, this.cellSize, this.cellSize, CORNER_RADIUS)
          .stroke({ color: 0xef4444, alpha: 0.5, width: 2 });
      }
    }
  }

  showHammerArea(area: HammerArea | null) {
    this.currentHammerArea = area;
    if (!area) {
      this.hammerPhase = 0;
      this.highlightGraphics.clear();
      return;
    }
    this.renderHammerArea();
  }

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

    const fx = this.boardOffsetX + area.startCol * cellFull;
    const fy = this.boardOffsetY + area.startRow * cellFull;
    const fw = (area.endCol - area.startCol + 1) * cellFull - GAP;
    const fh = (area.endRow - area.startRow + 1) * cellFull - GAP;
    this.highlightGraphics
      .roundRect(
        fx - 4 - 2 * pulse,
        fy - 4 - 2 * pulse,
        fw + 8 + 4 * pulse,
        fh + 8 + 4 * pulse,
        10,
      )
      .stroke({ color: 0xffd54a, alpha: 0.25 + 0.35 * pulse, width: 3 });
    this.highlightGraphics
      .roundRect(fx - 2, fy - 2, fw + 4, fh + 4, 8)
      .stroke({ color: 0xffe9a6, alpha: 0.95, width: 3 });
  }

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
