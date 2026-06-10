import { Application } from "pixi.js";
import { LevelConfig, BoardCell, FigureInstance } from "@/entities/game/model/types";
import { GameScene, SCENE_W, SCENE_H, GameSceneCallbacks } from "./GameScene";

export class GameApplication {
  private app: Application;
  private scene: GameScene | null = null;
  private container: HTMLDivElement;
  private resizeObserver: ResizeObserver;
  private _destroyed = false;

  /** External callbacks for state changes from Pixi -> React */
  callbacks: GameSceneCallbacks | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.app = new Application();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
  }

  async init(config: LevelConfig): Promise<void> {
    if (this._destroyed) return;

    const { clientWidth, clientHeight } = this.container;
    const w = clientWidth || SCENE_W;
    const h = clientHeight || SCENE_H;

    await this.app.init({
      width: w,
      height: h,
      backgroundColor: 0x1a0f07,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
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

  // ─── Booster proxies (React -> Pixi) ──────────────────────────

  /** Run the Collect All booster. Returns true if cells were cleared. */
  collectAll(): boolean {
    return this.scene?.collectAll() ?? false;
  }

  /** Enter the hammer 4×4 selection mode. */
  enterHammerMode() {
    this.scene?.enterHammerMode();
  }

  /** Cancel hammer selection without applying it. */
  exitHammerMode() {
    this.scene?.exitHammerMode();
  }

  destroy() {
    this._destroyed = true;
    this.resizeObserver.disconnect();
    if (this.scene) {
      this.scene.destroy({ children: true });
      this.scene = null;
    }
    this.app.destroy(true, { children: true });
    // Remove canvas from DOM
    const canvas = this.container.querySelector("canvas");
    canvas?.remove();
  }
}
