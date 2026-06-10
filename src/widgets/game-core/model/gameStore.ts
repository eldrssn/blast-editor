import { create } from "zustand";
import { GameState, LevelConfig, BoardCell, FigureInstance, BoosterType, GameStatus } from "@/entities/game/model/types";
import { createEmptyBoard } from "@/entities/game/lib/board";
import { generateFigureSet } from "@/entities/game/lib/figures";

export type GameStoreState = GameState & {
  initGame: (config: LevelConfig) => void;
  resetGame: () => void;
  setStatus: (status: GameStatus) => void;
  setBoard: (board: BoardCell[][]) => void;
  setCurrentFigures: (figures: FigureInstance[]) => void;
  setScore: (score: number) => void;
  addScore: (points: number) => void;
  setIsMultiplierActive: (active: boolean) => void;
  setActiveBooster: (booster: BoosterType | null) => void;
  setBoosterInventory: (inventory: Record<BoosterType, number>) => void;
  useBooster: (booster: BoosterType) => void;
  /**
   * Activate the multiplier booster. Idempotent: if it is already active or out
   * of charges (or the game is not in play) nothing happens, so re-activating
   * never corrupts the state or wastes a charge.
   */
  activateMultiplier: () => void;
  /** Mark a figure as placed by uid */
  markFigurePlaced: (uid: string) => void;
  /** Replace current figures with a new set */
  regenerateFigures: () => void;
  /**
   * Protection-from-loss clear: wipe the whole board and resume play.
   * No score is awarded for a protection clear (per level rules).
   */
  clearBoardAndContinue: () => void;
};

const defaultState: GameState = {
  status: "idle",
  config: null as unknown as LevelConfig,
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
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...defaultState,

  initGame: (config: LevelConfig) => {
    const board = createEmptyBoard(config.grid.rows, config.grid.cols, config.initialBoard);
    const currentFigures = generateFigureSet(config);

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
    });
  },

  resetGame: () => {
    const { config } = get();
    if (config) {
      get().initGame(config);
    }
  },

  setStatus: (status: GameStatus) => set({ status }),

  setBoard: (board: BoardCell[][]) => set({ board }),

  setCurrentFigures: (currentFigures: FigureInstance[]) => set({ currentFigures }),

  setScore: (score: number) => set({ score }),

  addScore: (points: number) => set((state) => ({ score: state.score + points })),

  setIsMultiplierActive: (isMultiplierActive: boolean) => set({ isMultiplierActive }),

  setActiveBooster: (activeBooster: BoosterType | null) => set({ activeBooster }),

  setBoosterInventory: (boosterInventory: Record<BoosterType, number>) => set({ boosterInventory }),

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

  markFigurePlaced: (uid: string) => {
    const { currentFigures } = get();
    set({
      currentFigures: currentFigures.map((f) =>
        f.uid === uid ? { ...f, placed: true } : f
      ),
    });
  },

  regenerateFigures: () => {
    const { config } = get();
    if (config) {
      set({ currentFigures: generateFigureSet(config) });
    }
  },

  clearBoardAndContinue: () => {
    const { config, currentFigures } = get();
    if (!config) return;

    // Fully empty board — protection clear wipes obstacles too.
    const board = createEmptyBoard(config.grid.rows, config.grid.cols);

    // Any figures still unplaced now fit on the empty board, but if the whole
    // set was already placed we generate a fresh one so the player can keep going.
    const figures = currentFigures.every((f) => f.placed)
      ? generateFigureSet(config)
      : currentFigures;

    set({ board, currentFigures: figures, status: "playing" });
  },
}));
