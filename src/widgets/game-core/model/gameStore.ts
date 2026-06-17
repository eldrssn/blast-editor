import { create } from "zustand";
import { GameState, LevelConfig, BoardCell, FigureInstance, BoosterType, GameStatus } from "@/entities/game/model/types";
import { createEmptyBoard } from "@/entities/game/lib/board";
import { generateFigureSet } from "@/entities/game/lib/figures";

export type GameStoreState = GameState & {
  initGame: (config: LevelConfig) => void;
  setStatus: (status: GameStatus) => void;
  setBoard: (board: BoardCell[][]) => void;
  setCurrentFigures: (figures: FigureInstance[]) => void;
  setScore: (score: number) => void;
  setActiveBooster: (booster: BoosterType | null) => void;
  useBooster: (booster: BoosterType) => void;
  /**
   * Activate the multiplier booster. Idempotent: if it is already active or out
   * of charges (or the game is not in play) nothing happens, so re-activating
   * never corrupts the state or wastes a charge.
   */
  activateMultiplier: () => void;
  /** Sync the scripted-opening cursor from the Pixi scene back into the store. */
  setScriptedSetIndex: (index: number) => void;
  /**
   * Protection-from-loss clear: wipe the whole board and resume play.
   * No score is awarded for a protection clear (per level rules).
   */
  clearBoardAndContinue: () => void;
};

const defaultState: GameState = {
  status: "idle",
  config: null,
  board: [],
  currentFigures: [],
  score: 0,
  targetScore: 0,
  activeBooster: null,
  isMultiplierActive: false,
  boosterInventory: {
    collectAll: 0,
    multiplier: 0,
    hammer: 0,
  },
  scriptedSetIndex: 0,
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...defaultState,

  initGame: (config: LevelConfig) => {
    const board = createEmptyBoard(config.grid.rows, config.grid.cols, config.initialBoard);
    // First set uses scripted-opening slot 0; the cursor then points at set 1.
    const currentFigures = generateFigureSet(config, board, 0);

    set({
      status: "playing",
      config,
      board,
      currentFigures,
      score: 0,
      targetScore: config.targetScore,
      activeBooster: null,
      isMultiplierActive: false,
      boosterInventory: {
        collectAll: config.boosters?.collectAll?.initialCount ?? 0,
        multiplier: config.boosters?.multiplier?.initialCount ?? 0,
        hammer: config.boosters?.hammer?.initialCount ?? 0,
      },
      scriptedSetIndex: 1,
    });
  },

  setStatus: (status: GameStatus) => set({ status }),

  setBoard: (board: BoardCell[][]) => set({ board }),

  setCurrentFigures: (currentFigures: FigureInstance[]) => set({ currentFigures }),

  setScore: (score: number) => set({ score }),

  setActiveBooster: (activeBooster: BoosterType | null) => set({ activeBooster }),

  useBooster: (booster: BoosterType) => {
    const { boosterInventory } = get();
    if (boosterInventory[booster] > 0) {
      set({
        boosterInventory: {
          ...boosterInventory,
          [booster]: boosterInventory[booster] - 1,
        },
      });
    }
  },

  setScriptedSetIndex: (scriptedSetIndex: number) => set({ scriptedSetIndex }),

  activateMultiplier: () => {
    const { status, isMultiplierActive, boosterInventory } = get();
    if (status !== "playing") return;
    if (isMultiplierActive) return;
    if (boosterInventory.multiplier <= 0) return;
    set({
      isMultiplierActive: true,
      boosterInventory: {
        ...boosterInventory,
        multiplier: boosterInventory.multiplier - 1,
      },
    });
  },

  clearBoardAndContinue: () => {
    const { config, currentFigures, score, scriptedSetIndex } = get();
    if (!config) return;

    // Fully empty board — protection clear wipes obstacles too.
    const board = createEmptyBoard(config.grid.rows, config.grid.cols);

    // Any figures still unplaced now fit on the empty board, but if the whole
    // set was already placed we generate a fresh one so the player can keep going.
    const regenerate = currentFigures.every((f) => f.placed);
    const figures = regenerate ? generateFigureSet(config, board, scriptedSetIndex) : currentFigures;
    const nextScriptedSetIndex = regenerate ? scriptedSetIndex + 1 : scriptedSetIndex;

    // Tester build: the protection clear is free — no score is deducted.
    set({ board, currentFigures: figures, status: "playing", score, scriptedSetIndex: nextScriptedSetIndex });
  },
}));
