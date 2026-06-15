import { Container, Graphics, Text, TextStyle } from "pixi.js";

/**
 * Builds the HUD level label from a levelId. Extracts the first number found
 * (e.g. "level_1" → "Уровень 1") and falls back to the raw id otherwise.
 */
export function formatLevelLabel(levelId: string): string {
  const match = levelId?.match(/\d+/);
  return match ? `Уровень ${match[0]}` : levelId || "";
}

const BAR_X = 16;
const BAR_Y = 44;
const BAR_H = 20;
const RADIUS = 10;
const PULSE_MS = 360;

export class HudLayer extends Container {
  private progressBg: Graphics;
  private progressFill: Graphics;
  private scoreText: Text;
  private titleText: Text;
  private multiplierBadge: Text;
  /** Whether the multiplier booster is active (drives the badge + glow). */
  private _multiplierActive: boolean = false;
  /** Configured multiplier value shown on the badge (e.g. ×2, ×3). */
  private _multiplierValue: number = 2;
  private _targetScore: number = 0;
  /** Actual logical score (animation target). */
  private _score: number = 0;
  /** Smoothly interpolated value shown on screen. */
  private _displayScore: number = 0;
  private _levelLabel: string = "";
  private _width: number = 0;
  /** Remaining pulse time in ms (set when water arrives). */
  private _pulse: number = 0;
  /** Free-running phase for the persistent multiplier glow animation. */
  private _glowPhase: number = 0;
  private _initialized = false;

  constructor() {
    super();
    this.progressBg = new Graphics();
    this.progressFill = new Graphics();
    this.scoreText = new Text({
      text: "0 / 0",
      style: new TextStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 18,
        fontWeight: "700",
        fill: "#ffffff",
        dropShadow: {
          alpha: 0.6,
          angle: Math.PI / 4,
          blur: 4,
          color: "#000000",
          distance: 2,
        },
      }),
    });
    this.titleText = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: "600",
        fill: "#e6c687",
      }),
    });

    this.multiplierBadge = new Text({
      text: "×2",
      style: new TextStyle({
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: "800",
        fill: "#ffe08a",
        stroke: { color: "#5a3a00", width: 3 },
      }),
    });
    this.multiplierBadge.visible = false;

    this.addChild(this.progressBg);
    this.addChild(this.progressFill);
    this.addChild(this.scoreText);
    this.addChild(this.titleText);
    this.addChild(this.multiplierBadge);
  }

  update(score: number, targetScore: number, levelId: string, containerWidth: number, isMultiplierActive = false, multiplierValue = 2) {
    this._score = score;
    this._targetScore = targetScore;
    this._levelLabel = formatLevelLabel(levelId);
    this._width = containerWidth;
    this._multiplierActive = isMultiplierActive;
    this._multiplierValue = multiplierValue;

    // Snap on the first render or whenever the score drops (reset / new level),
    // so the counter only animates upward during play.
    if (!this._initialized || score < this._displayScore) {
      this._displayScore = score;
      this._initialized = true;
    }
    this.redraw();
  }

  /**
   * Per-frame animation step (driven by the GameScene ticker).
   * Eases the displayed score toward the actual score and decays the pulse.
   */
  tick(dtMs: number) {
    let changed = false;

    if (Math.abs(this._displayScore - this._score) > 0.5) {
      const factor = Math.min((dtMs / 300) * 3, 1);
      this._displayScore += (this._score - this._displayScore) * factor;
      if (Math.abs(this._displayScore - this._score) <= 0.5) {
        this._displayScore = this._score;
      }
      changed = true;
    } else if (this._displayScore !== this._score) {
      this._displayScore = this._score;
      changed = true;
    }

    if (this._pulse > 0) {
      this._pulse = Math.max(0, this._pulse - dtMs);
      changed = true;
    }

    // Keep the multiplier glow breathing for as long as it's active.
    if (this._multiplierActive) {
      this._glowPhase += dtMs;
      changed = true;
    }

    if (changed) this.redraw();
  }

  /** Trigger a glow pulse on the progress bar (call when water arrives). */
  pulse() {
    this._pulse = PULSE_MS;
  }

  /**
   * Snap the displayed score to its target and drop the pulse. Called before the
   * ticker is paused (overlays) so the counter never freezes mid-animation.
   */
  snapScore() {
    this._displayScore = this._score;
    this._pulse = 0;
    this.redraw();
  }

  /**
   * World-space point at the leading edge of the current fill, used as the
   * destination for water droplet animations.
   */
  getWaterTargetPoint(): { x: number; y: number } {
    const barW = this._width - 32;
    const ratio = this._targetScore > 0 ? Math.min(this._displayScore / this._targetScore, 1) : 0;
    const fillW = ratio > 0 ? Math.max((barW - 2) * ratio, RADIUS * 2) : RADIUS * 2;
    return { x: BAR_X + 1 + fillW, y: BAR_Y + BAR_H / 2 };
  }

  private redraw() {
    const barW = this._width - 32;
    const ratio = this._targetScore > 0 ? Math.min(this._displayScore / this._targetScore, 1) : 0;
    const pulseT = this._pulse / PULSE_MS;

    // Background bar
    this.progressBg.clear();
    this.progressBg
      .roundRect(BAR_X, BAR_Y, barW, BAR_H, RADIUS)
      .fill({ color: 0x000000, alpha: 0.45 });
    this.progressBg
      .roundRect(BAR_X, BAR_Y, barW, BAR_H, RADIUS)
      .stroke({ color: 0xffffff, alpha: 0.1, width: 1 });

    // Fill bar
    this.progressFill.clear();
    if (ratio > 0) {
      const fillW = Math.max((barW - 2) * ratio, RADIUS * 2);
      this.progressFill
        .roundRect(BAR_X + 1, BAR_Y + 1, fillW, BAR_H - 2, RADIUS - 1)
        .fill({ color: 0x3b82f6 });
      // Glossy top highlight on the water.
      this.progressFill
        .roundRect(BAR_X + 3, BAR_Y + 3, Math.max(fillW - 4, 0), (BAR_H - 2) * 0.35, RADIUS - 2)
        .fill({ color: 0x93c5fd, alpha: 0.55 });
    }

    // Persistent breathing golden glow while the multiplier booster is active.
    if (this._multiplierActive) {
      const glow = 0.5 + 0.5 * Math.sin(this._glowPhase * 0.005);
      // Outer halo ring expands/contracts with the breath.
      this.progressFill
        .roundRect(BAR_X - 3 - 2 * glow, BAR_Y - 3 - 2 * glow, barW + 6 + 4 * glow, BAR_H + 6 + 4 * glow, RADIUS + 3)
        .stroke({ color: 0xffb648, alpha: 0.2 + 0.35 * glow, width: 3 });
      // Crisp inner border.
      this.progressFill
        .roundRect(BAR_X - 1, BAR_Y - 1, barW + 2, BAR_H + 2, RADIUS + 1)
        .stroke({ color: 0xffe08a, alpha: 0.7 + 0.3 * glow, width: 2 });
    }

    // Pulse glow when water lands.
    if (pulseT > 0) {
      this.progressFill
        .roundRect(BAR_X, BAR_Y, barW, BAR_H, RADIUS)
        .stroke({ color: 0x9fd4ff, alpha: 0.85 * pulseT, width: 3 });
    }

    // Score text — centered inside bar
    this.scoreText.text = `${Math.round(this._displayScore)} / ${this._targetScore}`;
    this.scoreText.style.fontSize = 12;
    this.scoreText.anchor.set(0.5, 0.5);
    this.scoreText.x = BAR_X + barW / 2;
    this.scoreText.y = BAR_Y + BAR_H / 2;
    this.scoreText.scale.set(1 + 0.12 * pulseT);

    // Level label above bar
    this.titleText.text = this._levelLabel;
    this.titleText.style.fontSize = 13;
    this.titleText.anchor.set(0.5, 0);
    this.titleText.x = this._width / 2;
    this.titleText.y = 14;

    // "×N" badge under the bar while the multiplier is active
    this.multiplierBadge.visible = this._multiplierActive;
    if (this._multiplierActive) {
      // Trim trailing ".0" so ×2 stays "×2" but ×1.5 reads "×1.5".
      this.multiplierBadge.text = `×${Number(this._multiplierValue.toFixed(2))}`;
      this.multiplierBadge.anchor.set(1, 0);
      this.multiplierBadge.x = BAR_X + barW;
      this.multiplierBadge.y = BAR_Y + BAR_H + 3;
      // Gentle breathing pulse (plus an extra kick when water lands).
      const glow = 0.5 + 0.5 * Math.sin(this._glowPhase * 0.005);
      this.multiplierBadge.scale.set(1 + 0.06 * glow + 0.08 * pulseT);
    }
  }
}
