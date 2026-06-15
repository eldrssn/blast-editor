import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { FigureInstance, GridPosition } from "@/entities/game/model/types";
import { drawPseudo3DCube } from "./cube";
import { soundManager } from "@/shared/lib/sound";

const SLOT_COUNT = 3;
const FIGURE_SCALE_IN_SLOT = 0.55;
const SLOT_HEIGHT = 120;
const LEVITATION_AMPLITUDE = 3;
const LEVITATION_SPEED = 0.002;

/** Describes the dragging state for one figure */
type DragState = {
  figureIndex: number;
  figure: FigureInstance;
  /** The dragged container (full-size figure) */
  dragContainer: Container;
  /** Current pointer position in scene coords */
  pointerX: number;
  pointerY: number;
  /** Offset from pointer to figure origin so it feels natural */
  offsetX: number;
  offsetY: number;
};

export type FigurePlacementEvent = {
  figureIndex: number;
  figure: FigureInstance;
  gridPosition: GridPosition;
};

export type GridInfoProvider = () => {
  cellSize: number;
  boardOffsetX: number;
  boardOffsetY: number;
  rows: number;
  cols: number;
  gap: number;
};

export class FigureLayer extends Container {
  private slotContainers: Container[] = [];
  private slotBgs: Graphics[] = [];
  private dragState: DragState | null = null;
  private dragOverlay: Container; // rendered above everything during drag
  private boardCellSize: number = 0;
  private sceneWidth: number = 450;
  private sceneHeight: number = 800;
  private figures: FigureInstance[] = [];

  /** Levitation animation */
  private levitationPhases: number[] = [];
  private animationFrame: number = 0;

  /** Active rAF ids for bounce/return animations, cancelled on destroy. */
  private rafIds = new Set<number>();
  /** Guards animation callbacks from touching the layer after teardown. */
  private isDestroyed = false;

  /** External callbacks */
  onPlacementAttempt: ((event: FigurePlacementEvent) => boolean) | null = null;
  onPlacementSuccess: ((event: FigurePlacementEvent) => void) | null = null;
  onHighlightUpdate: ((gridPos: GridPosition | null, figure: FigureInstance | null, valid: boolean) => void) | null = null;
  getGridInfo: GridInfoProvider | null = null;

  /** Validation callback — checks if placement is valid at given grid position */
  canPlaceAt: ((figure: FigureInstance, row: number, col: number) => boolean) | null = null;

  constructor() {
    super();
    this.eventMode = "static";

    for (let i = 0; i < SLOT_COUNT; i++) {
      const bg = new Graphics();
      const slot = new Container();
      slot.addChild(bg);
      this.slotBgs.push(bg);
      this.slotContainers.push(slot);
      this.addChild(slot);
      this.levitationPhases.push(Math.random() * Math.PI * 2);
    }

    // Drag overlay sits on top of everything
    this.dragOverlay = new Container();
    this.dragOverlay.zIndex = 1000;
    this.addChild(this.dragOverlay);

    // Global pointer events for drag
    this.on("globalpointermove", this.onPointerMove, this);
    this.on("pointerup", this.onPointerUp, this);
    this.on("pointerupoutside", this.onPointerUp, this);
  }

  /**
   * Draw the 3 figure slots at the bottom of the scene.
   */
  draw(
    figures: FigureInstance[],
    sceneW: number,
    sceneH: number,
    boardCellSize: number
  ) {
    this.figures = figures;
    this.boardCellSize = boardCellSize;
    this.sceneWidth = sceneW;
    this.sceneHeight = sceneH;

    const cellSize = Math.max(boardCellSize * FIGURE_SCALE_IN_SLOT, 10);
    const gap = 2;
    const slotW = sceneW / SLOT_COUNT;
    const slotY = sceneH - SLOT_HEIGHT;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.slotContainers[i];
      const bg = this.slotBgs[i];
      const slotX = i * slotW;

      slot.x = slotX;
      slot.y = slotY;

      // Draw slot background frame
      bg.clear();
      bg.roundRect(4, 4, slotW - 8, SLOT_HEIGHT - 8, 14).fill({
        color: 0x000000,
        alpha: 0.35,
      });
      bg.roundRect(4, 4, slotW - 8, SLOT_HEIGHT - 8, 14).stroke({
        color: 0xffffff,
        alpha: 0.08,
        width: 1,
      });

      // Remove old figure graphics (children after bg) and free their GPU
      // resources — removeChild alone leaves geometry around until GC.
      this.clearSlotFigure(slot);

      const figure = figures[i];
      if (!figure || figure.placed) continue;

      // Don't draw in slot if it's being dragged
      if (this.dragState && this.dragState.figureIndex === i) continue;

      // Compute figure bounding box
      const minRow = Math.min(...figure.cells.map((c) => c.row));
      const maxRow = Math.max(...figure.cells.map((c) => c.row));
      const minCol = Math.min(...figure.cells.map((c) => c.col));
      const maxCol = Math.max(...figure.cells.map((c) => c.col));
      const figW = (maxCol - minCol + 1) * (cellSize + gap);
      const figH = (maxRow - minRow + 1) * (cellSize + gap);

      const figContainer = new Container();
      figContainer.eventMode = "static";
      figContainer.cursor = "grab";

      const figG = new Graphics();
      const originX = (slotW - figW) / 2;
      const originY = (SLOT_HEIGHT - figH) / 2 - 4;

      for (const cell of figure.cells) {
        const cx = originX + (cell.col - minCol) * (cellSize + gap);
        const cy = originY + (cell.row - minRow) * (cellSize + gap);
        drawPseudo3DCube(figG, cx, cy, cellSize, figure.color);
      }

      figContainer.addChild(figG);

      figContainer.on("pointerdown", (e: FederatedPointerEvent) => {
        this.onFigurePointerDown(e, i);
      });

      slot.addChild(figContainer);
    }
  }

  /**
   * Update levitation animation — called from GameScene tick.
   */
  updateLevitation(elapsed: number) {
    this.animationFrame += elapsed;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = this.slotContainers[i];
      const figure = this.figures[i];
      if (!figure || figure.placed) continue;
      if (this.dragState && this.dragState.figureIndex === i) continue;

      const figChild = slot.children[1];
      if (!figChild) continue;

      const phase = this.levitationPhases[i];
      const t = this.animationFrame * LEVITATION_SPEED + phase;
      figChild.y = Math.sin(t) * LEVITATION_AMPLITUDE;
    }
  }

  // ─── Drag Logic ──────────────────────────────────────────────

  private onFigurePointerDown(e: FederatedPointerEvent, figureIndex: number) {
    const figure = this.figures[figureIndex];
    if (!figure || figure.placed) return;

    e.stopPropagation();
    soundManager.play("pick");

    // Create a full-size dragged figure
    const dragContainer = this.createDragFigure(figure);

    // Position drag figure at pointer, centered on the figure
    const localPos = this.toLocal(e.global);
    const figBounds = this.getFigureBoundsInCells(figure);
    const fullCellSize = this.boardCellSize;
    const gap = 2;
    const figW = figBounds.cols * (fullCellSize + gap);
    const figH = figBounds.rows * (fullCellSize + gap);

    // Center the figure slightly above the pointer for visibility (finger offset)
    const offsetX = figW / 2;
    const offsetY = figH + 20; // Place above finger

    dragContainer.x = localPos.x - offsetX;
    dragContainer.y = localPos.y - offsetY;

    this.dragOverlay.addChild(dragContainer);

    this.dragState = {
      figureIndex,
      figure,
      dragContainer,
      pointerX: localPos.x,
      pointerY: localPos.y,
      offsetX,
      offsetY,
    };

    // Hide the figure in the slot
    this.redrawSlotWithoutFigure(figureIndex);
  }

  private onPointerMove(e: FederatedPointerEvent) {
    if (!this.dragState) return;

    const localPos = this.toLocal(e.global);
    this.dragState.pointerX = localPos.x;
    this.dragState.pointerY = localPos.y;

    this.dragState.dragContainer.x = localPos.x - this.dragState.offsetX;
    this.dragState.dragContainer.y = localPos.y - this.dragState.offsetY;

    // Check grid position for highlight
    const gridPos = this.getGridPositionFromPointer(localPos.x, localPos.y);
    if (gridPos && this.canPlaceAt) {
      const valid = this.canPlaceAt(this.dragState.figure, gridPos.row, gridPos.col);
      this.onHighlightUpdate?.(gridPos, this.dragState.figure, valid);
    } else {
      this.onHighlightUpdate?.(null, null, false);
    }
  }

  private onPointerUp() {
    if (!this.dragState) return;

    const { figure, figureIndex, dragContainer, pointerX, pointerY } = this.dragState;

    // Check if pointer is over the board
    const gridPos = this.getGridPositionFromPointer(pointerX, pointerY);
    let placed = false;

    if (gridPos && this.canPlaceAt) {
      const valid = this.canPlaceAt(figure, gridPos.row, gridPos.col);
      if (valid) {
        // Attempt placement
        const event: FigurePlacementEvent = { figureIndex, figure, gridPosition: gridPos };
        const accepted = this.onPlacementAttempt?.(event) ?? false;
        if (accepted) {
          placed = true;
          soundManager.play("place");
          const finish = () => {
            this.dragOverlay.removeChild(dragContainer);
            dragContainer.destroy({ children: true });
            this.onPlacementSuccess?.(event);
          };
          // Bounce animation on placement.
          this.playBounceAnimation(dragContainer, finish);
        }
      }
    }

    // Clear highlight
    this.onHighlightUpdate?.(null, null, false);

    if (!placed) {
      soundManager.play("invalid");
      // Return to slot with smooth animation
      this.animateReturnToSlot(dragContainer, figureIndex, () => {
        this.dragOverlay.removeChild(dragContainer);
        dragContainer.destroy({ children: true });
        // Re-render figures to show the figure back in slot
        this.draw(this.figures, this.sceneWidth, this.sceneHeight, this.boardCellSize);
      });
    }

    this.dragState = null;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private createDragFigure(figure: FigureInstance): Container {
    const container = new Container();
    const cellSize = this.boardCellSize;
    const gap = 2;

    const minRow = Math.min(...figure.cells.map((c) => c.row));
    const minCol = Math.min(...figure.cells.map((c) => c.col));

    // Soft contact shadow cast by the whole lifted figure (drawn first, behind
    // the cubes, offset down-right so the piece reads as floating above the board).
    const shadow = new Graphics();
    const SHADOW_OFFSET = 10;
    for (const cell of figure.cells) {
      const cx = (cell.col - minCol) * (cellSize + gap);
      const cy = (cell.row - minRow) * (cellSize + gap);
      shadow.roundRect(cx + SHADOW_OFFSET, cy + SHADOW_OFFSET, cellSize, cellSize, 6);
    }
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(shadow);

    const g = new Graphics();
    for (const cell of figure.cells) {
      const cx = (cell.col - minCol) * (cellSize + gap);
      const cy = (cell.row - minRow) * (cellSize + gap);
      drawPseudo3DCube(g, cx, cy, cellSize, figure.color, 0.92);
    }
    container.addChild(g);
    container.alpha = 0.95;
    return container;
  }

  private getFigureBoundsInCells(figure: FigureInstance) {
    const minRow = Math.min(...figure.cells.map((c) => c.row));
    const maxRow = Math.max(...figure.cells.map((c) => c.row));
    const minCol = Math.min(...figure.cells.map((c) => c.col));
    const maxCol = Math.max(...figure.cells.map((c) => c.col));
    return {
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
      minRow,
      minCol,
    };
  }

  private getGridPositionFromPointer(px: number, py: number): GridPosition | null {
    if (!this.getGridInfo) return null;
    const info = this.getGridInfo();
    if (!info || info.cellSize <= 0) return null;

    const { boardOffsetX, boardOffsetY, cellSize, gap, rows, cols } = info;
    const cellFull = cellSize + gap;

    // Use the center of the dragged figure as reference
    const figure = this.dragState?.figure;
    if (!figure) return null;

    const bounds = this.getFigureBoundsInCells(figure);
    const figW = bounds.cols * cellFull;
    const figH = bounds.rows * cellFull;

    // The pointer is at the center, but figure is offset above by offsetY
    // Use the actual dragContainer position for better calculation
    const dragX = px - (this.dragState?.offsetX ?? 0);
    const dragY = py - (this.dragState?.offsetY ?? 0);

    // Figure center
    const centerX = dragX + figW / 2;
    const centerY = dragY + figH / 2;

    // Map to grid
    const gridCol = Math.round((centerX - boardOffsetX - figW / 2) / cellFull);
    const gridRow = Math.round((centerY - boardOffsetY - figH / 2) / cellFull);

    // Must be within bounds for at least the origin cell to make sense
    if (gridRow < -bounds.rows + 1 || gridRow >= rows + bounds.rows) return null;
    if (gridCol < -bounds.cols + 1 || gridCol >= cols + bounds.cols) return null;

    return { row: gridRow, col: gridCol };
  }

  private redrawSlotWithoutFigure(figureIndex: number) {
    // Remove figure graphics but keep bg (child 0).
    this.clearSlotFigure(this.slotContainers[figureIndex]);
  }

  /** Remove + destroy every child of a slot except its background (index 0). */
  private clearSlotFigure(slot: Container) {
    while (slot.children.length > 1) {
      const child = slot.children[slot.children.length - 1];
      slot.removeChild(child);
      child.destroy({ children: true });
    }
  }

  // ─── Animations ──────────────────────────────────────────────

  /**
   * requestAnimationFrame wrapper that tracks the pending id so it can be
   * cancelled in destroy(), and skips the callback if the layer is gone.
   */
  private scheduleRaf(cb: () => void) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      if (this.isDestroyed) return;
      cb();
    });
    this.rafIds.add(id);
  }

  private playBounceAnimation(container: Container, onComplete: () => void) {
    const originalScale = container.scale.x;
    const bounceUp = 1.12;
    const bounceDuration = 180; // ms
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const t = Math.min(elapsed / bounceDuration, 1);

      if (t < 0.5) {
        // Scale up
        const s = originalScale + (bounceUp - originalScale) * (t * 2);
        container.scale.set(s);
      } else {
        // Scale back
        const s = bounceUp + (originalScale - bounceUp) * ((t - 0.5) * 2);
        container.scale.set(s);
      }

      if (t < 1) {
        this.scheduleRaf(animate);
      } else {
        container.scale.set(originalScale);
        onComplete();
      }
    };
    this.scheduleRaf(animate);
  }

  private animateReturnToSlot(
    container: Container,
    slotIndex: number,
    onComplete: () => void
  ) {
    const slotW = this.sceneWidth / SLOT_COUNT;
    const slotY = this.sceneHeight - SLOT_HEIGHT;
    const targetX = slotIndex * slotW + slotW / 2 - 20;
    const targetY = slotY + SLOT_HEIGHT / 2 - 20;

    const startX = container.x;
    const startY = container.y;
    const startScale = container.scale.x;
    const targetScale = FIGURE_SCALE_IN_SLOT;
    const duration = 220; // ms
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      container.x = startX + (targetX - startX) * ease;
      container.y = startY + (targetY - startY) * ease;
      container.scale.set(startScale + (targetScale - startScale) * ease);
      container.alpha = 0.9 + 0.1 * ease;

      if (t < 1) {
        this.scheduleRaf(animate);
      } else {
        onComplete();
      }
    };
    this.scheduleRaf(animate);
  }

  /** Returns bottom slot height so GameScene can account for it */
  static get slotHeight() {
    return SLOT_HEIGHT;
  }

  /** Cancel any in-flight bounce/return animations and free resources. */
  override destroy(options?: Parameters<typeof Container.prototype.destroy>[0]) {
    this.isDestroyed = true;
    for (const id of this.rafIds) cancelAnimationFrame(id);
    this.rafIds.clear();
    super.destroy(options);
  }
}
