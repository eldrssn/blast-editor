import { Application } from "pixi.js";
import { LevelConfig, BoardCell, FigureInstance } from "@/entities/game/model/types";
import { GameScene, SCENE_W, SCENE_H, GameSceneCallbacks } from "./GameScene";

export class GameApplication {
  private app: Application;
  private scene: GameScene | null = null;
  private container: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private resizeRaf: number | null = null;
  private _destroyed = false;

  /** External callbacks for state changes from Pixi -> React */
  callbacks: GameSceneCallbacks | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.app = new Application();
    this.resizeObserver = new ResizeObserver(this.scheduleResize);
  }

  /** Coalesce bursts of resize events into a single per-frame layout pass. */
  private scheduleResize = () => {
    if (this.resizeRaf !== null || this._destroyed) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.handleResize();
    });
  };

  async init(config: LevelConfig): Promise<void> {
    if (this._destroyed) return;

    const { clientWidth, clientHeight } = this.container;
    const w = clientWidth || SCENE_W;
    const h = clientHeight || SCENE_H;

    // Cap the device pixel ratio: a DPR-3 phone would otherwise render 9× the
    // pixels of a logical one. 2 stays crisp while keeping the fill rate sane on
    // weak GPUs.
    const resolution = Math.min(window.devicePixelRatio || 1, 2);

    await this.app.init({
      width: w,
      height: h,
      backgroundColor: 0x1a0f07,
      antialias: true,
      resolution,
      autoDensity: true,
    });

    if (this._destroyed) {
      this.app.destroy(true);
      return;
    }

    // Mount canvas
    this.container.appendChild(this.app.canvas as HTMLCanvasElement);

    // Enable interaction events on the stage
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    // Build scene
    this.scene = new GameScene(config);
    if (this.callbacks) {
      this.scene.callbacks = this.callbacks;
    }
    this.app.stage.addChild(this.scene);

    // Scale scene to fit container (letterbox)
    this.handleResize();
    this.resizeObserver.observe(this.container);
  }

  private handleResize() {
    if (!this.scene) return;
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;

    const scaleX = clientWidth / SCENE_W;
    const scaleY = clientHeight / SCENE_H;
    const scale = Math.min(scaleX, scaleY);

    this.scene.scale.set(scale);
    this.scene.x = (clientWidth - SCENE_W * scale) / 2;
    this.scene.y = (clientHeight - SCENE_H * scale) / 2;

    this.app.renderer.resize(clientWidth, clientHeight);
  }

  /**
   * Push the latest game state into the scene for rendering.
   */
  updateState(board: BoardCell[][], figures: FigureInstance[], score: number, isMultiplierActive?: boolean) {
    if (!this.scene || this._destroyed) return;
    this.scene.renderState(board, figures, score, isMultiplierActive);
  }

  /**
   * Mirror the scripted-opening cursor into the scene. Kept separate from
   * `updateState` so a cursor-only sync (e.g. the echo after the scene's own
   * regeneration) never triggers a full board/figure re-render.
   */
  setScriptedSetIndex(scriptedSetIndex: number) {
    if (!this.scene || this._destroyed) return;
    this.scene.setScriptedSetIndex(scriptedSetIndex);
  }

  // ─── Booster proxies (React -> Pixi) ──────────────────────────

  /** Run the Collect All booster. Returns true if cells were cleared. */
  collectAll(): boolean {
    return this.scene?.collectAll() ?? false;
  }

  /** Animate the protection board clear (cube pops, no water/score). */
  playBoardClear(onComplete: () => void) {
    if (!this.scene || this._destroyed) {
      onComplete();
      return;
    }
    this.scene.playBoardClear(onComplete);
  }

  /** Enter the hammer 4×4 selection mode. */
  enterHammerMode() {
    this.scene?.enterHammerMode();
  }

  /** Cancel hammer selection without applying it. */
  exitHammerMode() {
    this.scene?.exitHammerMode();
  }

  /** Confirm the currently selected hammer area. */
  confirmHammerMode() {
    return this.scene?.confirmHammerMode() ?? false;
  }

  /** Pause/resume the scene's idle animation ticker (driven by game status). */
  setTickerActive(active: boolean) {
    this.scene?.setTickerActive(active);
  }

  /** Apply cosmetic config changes in place (no rebuild / no level restart). */
  applyVisualConfig(config: LevelConfig) {
    this.scene?.applyVisualConfig(config);
  }

  destroy() {
    if (this._destroyed) return;

    this._destroyed = true;
    this.resizeObserver.disconnect();
    if (this.resizeRaf !== null) {
      cancelAnimationFrame(this.resizeRaf);
      this.resizeRaf = null;
    }
    if (this.scene) {
      this.scene.destroy({ children: true });
      this.scene = null;
    }
    this.app.destroy({ removeView: true }, { children: true });
    // Remove canvas from DOM
    const canvas = this.container.querySelector("canvas");
    canvas?.remove();
  }
}
