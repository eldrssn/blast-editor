import { Howl } from "howler";

/**
 * Sound stub.
 *
 * The procedural WAV synthesizer was removed: audio is expected to ship as real
 * asset files later. Until then `play()` is a no-op and nothing is heard. The
 * call sites across the game (pick / place / invalid / lineClear / booster /
 * win / lose) stay in place, so dropping the files in is the only step needed to
 * turn sound on.
 *
 * NOTE: there is intentionally no enable/disable toggle here. Whether sound
 * plays at all is owned by the host application that embeds this core game, not
 * by the level config.
 *
 * To enable: drop asset files under `public/sounds/` and fill `SOUND_FILES`,
 * e.g. `pick: ["/sounds/pick.webm", "/sounds/pick.mp3"]`.
 */

export type SoundName =
  | "pick"
  | "place"
  | "invalid"
  | "lineClear"
  | "booster"
  | "win"
  | "lose";

/**
 * Maps each sound to its asset sources (passed straight to Howler `src`).
 * Empty until real audio files are added — an empty/absent entry makes
 * `play()` a safe no-op.
 */
const SOUND_FILES: Partial<Record<SoundName, string[]>> = {
  // pick: ["/sounds/pick.webm", "/sounds/pick.mp3"],
  // place: ["/sounds/place.webm", "/sounds/place.mp3"],
  // invalid: ["/sounds/invalid.webm", "/sounds/invalid.mp3"],
  // lineClear: ["/sounds/line-clear.webm", "/sounds/line-clear.mp3"],
  // booster: ["/sounds/booster.webm", "/sounds/booster.mp3"],
  // win: ["/sounds/win.webm", "/sounds/win.mp3"],
  // lose: ["/sounds/lose.webm", "/sounds/lose.mp3"],
};

class SoundManager {
  private howls: Partial<Record<SoundName, Howl>> = {};

  /** Lazily build a Howl on first use, only when an asset is registered. */
  private ensure(name: SoundName): Howl | undefined {
    if (typeof window === "undefined") return undefined;
    const src = SOUND_FILES[name];
    if (!src || src.length === 0) return undefined; // no asset yet → no-op

    let howl = this.howls[name];
    if (!howl) {
      howl = new Howl({ src, volume: 0.8 });
      this.howls[name] = howl;
    }
    return howl;
  }

  play(name: SoundName) {
    this.ensure(name)?.play();
  }
}

/** Shared singleton — the Pixi scene and React HUD both play through this. */
export const soundManager = new SoundManager();
