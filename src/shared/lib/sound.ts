import { Howl } from "howler";

/**
 * Procedural sound system (Промпт 10, item 11).
 *
 * The project ships without audio assets, so instead of bundling files we
 * synthesize a handful of short tones at module load and hand them to Howler as
 * base64 WAV data-URIs. Howler then owns playback, mixing and the browser
 * autoplay unlock (the first `pick` happens on a pointerdown, a user gesture).
 *
 * Everything is gated by a single `enabled` flag driven from the level's
 * `visual.soundEnabled` config (item 12: эффекты/звук отключаемы).
 */

export type SoundName =
  | "pick"
  | "place"
  | "invalid"
  | "lineClear"
  | "booster"
  | "win"
  | "lose";

const SAMPLE_RATE = 22050;

type Wave = "sine" | "square" | "saw" | "triangle";

function oscillator(type: Wave, phase: number): number {
  // phase is in turns (0..1)
  const p = phase - Math.floor(phase);
  switch (type) {
    case "sine":
      return Math.sin(p * Math.PI * 2);
    case "square":
      return p < 0.5 ? 1 : -1;
    case "saw":
      return 2 * p - 1;
    case "triangle":
      return 4 * Math.abs(p - 0.5) - 1;
  }
}

type ToneSpec = {
  duration: number;
  /** Constant frequency or a glide function of normalized time (0..1). */
  freq: number | ((t: number) => number);
  type?: Wave;
  volume?: number;
  /** Attack time in seconds (linear fade-in). */
  attack?: number;
  /** Exponential decay strength; higher = snappier tail. */
  decay?: number;
  vibrato?: { rate: number; depth: number };
};

/** Render a single tone into a Float32 sample buffer. */
function makeTone(spec: ToneSpec): Float32Array {
  const {
    duration,
    freq,
    type = "sine",
    volume = 0.6,
    attack = 0.005,
    decay = 4,
    vibrato,
  } = spec;

  const n = Math.floor(duration * SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const seconds = i / SAMPLE_RATE;

    let f = typeof freq === "function" ? freq(t) : freq;
    if (vibrato) {
      f *= 1 + Math.sin(seconds * vibrato.rate * Math.PI * 2) * vibrato.depth;
    }

    phase += f / SAMPLE_RATE;

    // Envelope: linear attack, exponential decay.
    const atk = attack > 0 ? Math.min(seconds / attack, 1) : 1;
    const env = atk * Math.exp(-decay * t);

    out[i] = oscillator(type, phase) * env * volume;
  }

  return out;
}

/** Concatenate buffers end-to-end (used for arpeggios). */
function concat(...buffers: Float32Array[]): Float32Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const b of buffers) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

/** Mix buffers on top of each other (used for chords/shimmer). */
function mix(...buffers: Float32Array[]): Float32Array {
  const len = Math.max(...buffers.map((b) => b.length));
  const out = new Float32Array(len);
  for (const b of buffers) {
    for (let i = 0; i < b.length; i++) out[i] += b[i];
  }
  return out;
}

/** Encode mono Float32 samples as a base64 16-bit PCM WAV data-URI. */
function toWavDataUri(samples: Float32Array): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  // ArrayBuffer -> binary string -> base64. Buffers are small (<25KB).
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return `data:audio/wav;base64,${base64}`;
}

/** Lazily-built recipes so the (small) synthesis cost is paid only in browsers. */
const RECIPES: Record<SoundName, () => Float32Array> = {
  // Short rising blip when a figure is picked up.
  pick: () =>
    makeTone({ duration: 0.09, freq: (t) => 440 + 320 * t, type: "sine", volume: 0.5, decay: 5 }),

  // Soft "thunk" when a figure lands.
  place: () =>
    mix(
      makeTone({ duration: 0.12, freq: (t) => 260 - 80 * t, type: "triangle", volume: 0.55, decay: 7 }),
      makeTone({ duration: 0.05, freq: 600, type: "square", volume: 0.18, decay: 12 })
    ),

  // Low buzz for an invalid drop.
  invalid: () =>
    makeTone({
      duration: 0.2,
      freq: 150,
      type: "saw",
      volume: 0.4,
      decay: 2.5,
      vibrato: { rate: 22, depth: 0.08 },
    }),

  // Bright ascending arpeggio for a line clear.
  lineClear: () =>
    concat(
      makeTone({ duration: 0.08, freq: 523, type: "sine", volume: 0.5, decay: 3 }),
      makeTone({ duration: 0.08, freq: 659, type: "sine", volume: 0.5, decay: 3 }),
      makeTone({ duration: 0.14, freq: 784, type: "sine", volume: 0.55, decay: 4 })
    ),

  // Sparkly shimmer for boosters.
  booster: () =>
    mix(
      makeTone({ duration: 0.28, freq: 880, type: "sine", volume: 0.35, decay: 3, vibrato: { rate: 14, depth: 0.04 } }),
      makeTone({ duration: 0.28, freq: 1318, type: "sine", volume: 0.25, decay: 4, vibrato: { rate: 18, depth: 0.05 } })
    ),

  // Triumphant 4-note arpeggio.
  win: () =>
    concat(
      makeTone({ duration: 0.11, freq: 523, type: "triangle", volume: 0.5, decay: 2.5 }),
      makeTone({ duration: 0.11, freq: 659, type: "triangle", volume: 0.5, decay: 2.5 }),
      makeTone({ duration: 0.11, freq: 784, type: "triangle", volume: 0.5, decay: 2.5 }),
      makeTone({ duration: 0.24, freq: 1046, type: "triangle", volume: 0.55, decay: 3 })
    ),

  // Descending sad slide.
  lose: () =>
    makeTone({
      duration: 0.5,
      freq: (t) => 420 - 240 * t,
      type: "triangle",
      volume: 0.45,
      decay: 1.8,
      vibrato: { rate: 6, depth: 0.03 },
    }),
};

class SoundManager {
  private howls: Partial<Record<SoundName, Howl>> = {};
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Synthesize + register a single Howl on first use. Building one short tone at
   * a time keeps the very first `pick` from synthesizing all seven sounds on the
   * pointer thread (a noticeable hitch on weak devices).
   */
  private ensure(name: SoundName): Howl | undefined {
    if (typeof window === "undefined") return undefined;
    let howl = this.howls[name];
    if (!howl) {
      howl = new Howl({
        src: [toWavDataUri(RECIPES[name]())],
        format: ["wav"],
        volume: 0.8,
      });
      this.howls[name] = howl;
    }
    return howl;
  }

  play(name: SoundName) {
    if (!this.enabled || typeof window === "undefined") return;
    this.ensure(name)?.play();
  }
}

/** Shared singleton — the Pixi scene and React HUD both play through this. */
export const soundManager = new SoundManager();
