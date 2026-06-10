"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { LevelConfig } from "@/entities/game/model/types";
import { useGameStore } from "../model/gameStore";
import { GameApplication } from "../pixi/GameApplication";
import { GameSceneCallbacks } from "../pixi/GameScene";
import { soundManager } from "@/shared/lib/sound";
import styles from "../styles/GameCore.module.scss";

type GameCoreProps = {
  config: LevelConfig;
};

export default function GameCore({ config }: GameCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameAppRef = useRef<GameApplication | null>(null);

  // Zustand store
  const initGame = useGameStore((s) => s.initGame);
  const board = useGameStore((s) => s.board);
  const currentFigures = useGameStore((s) => s.currentFigures);
  const score = useGameStore((s) => s.score);
  const isMultiplierActive = useGameStore((s) => s.isMultiplierActive);
  const status = useGameStore((s) => s.status);
  const boosterInventory = useGameStore((s) => s.boosterInventory);
  const activeBooster = useGameStore((s) => s.activeBooster);

  // Store setters (stable references via zustand)
  const setStatus = useGameStore((s) => s.setStatus);
  const clearBoardAndContinue = useGameStore((s) => s.clearBoardAndContinue);

  // "Короб заполнен" when every cell is occupied, otherwise just no valid moves.
  const isBoardFull =
    board.length > 0 && board.every((row) => row.every((cell) => cell.filled));

  // Boosters that need at least one block on the board to do anything.
  const hasFilledCells =
    board.length > 0 && board.some((row) => row.some((cell) => cell.filled));

  const isPlaying = status === "playing";
  const isHammerSelecting = status === "booster_selecting" && activeBooster === "hammer";
  const showBoosters = isPlaying || isHammerSelecting;

  // Build callbacks for Pixi scene -> Zustand store
  const callbacksRef = useRef<GameSceneCallbacks>({
    onBoardUpdate: (newBoard) => {
      useGameStore.getState().setBoard(newBoard);
    },
    onFiguresUpdate: (newFigures) => {
      useGameStore.getState().setCurrentFigures(newFigures);
    },
    onScoreUpdate: (newScore) => {
      useGameStore.getState().setScore(newScore);
    },
    onStatusUpdate: (newStatus) => {
      useGameStore.getState().setStatus(newStatus);
    },
    onHammerComplete: (consumed) => {
      const store = useGameStore.getState();
      if (consumed) {
        store.useBooster("hammer");
        soundManager.play("booster");
      }
      store.setActiveBooster(null);
      store.setStatus("playing");
    },
  });

  // ─── Booster handlers ───────────────────────────────────────────

  const handleCollectAll = useCallback(() => {
    const store = useGameStore.getState();
    if (store.status !== "playing") return;
    if (store.boosterInventory.collectAll <= 0) return;
    const applied = gameAppRef.current?.collectAll() ?? false;
    if (applied) {
      store.useBooster("collectAll");
      soundManager.play("booster");
    }
  }, []);

  const handleMultiplier = useCallback(() => {
    // Guards (playing / has charge / not already active) live in the store
    // action so re-activation can never waste a charge or corrupt state.
    const before = useGameStore.getState().isMultiplierActive;
    useGameStore.getState().activateMultiplier();
    if (!before && useGameStore.getState().isMultiplierActive) {
      soundManager.play("booster");
    }
  }, []);

  const handleHammer = useCallback(() => {
    const store = useGameStore.getState();
    if (store.status !== "playing") return;
    if (store.boosterInventory.hammer <= 0) return;
    store.setActiveBooster("hammer");
    store.setStatus("booster_selecting");
    gameAppRef.current?.enterHammerMode();
  }, []);

  const handleCancelHammer = useCallback(() => {
    gameAppRef.current?.exitHammerMode();
    const store = useGameStore.getState();
    store.setActiveBooster(null);
    store.setStatus("playing");
  }, []);

  // Boot or reboot the Pixi application whenever config changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize game state in the store
    initGame(config);

    // Destroy previous Pixi instance
    if (gameAppRef.current) {
      gameAppRef.current.destroy();
      gameAppRef.current = null;
    }

    const gameApp = new GameApplication(containerRef.current);
    gameApp.callbacks = callbacksRef.current;
    gameAppRef.current = gameApp;

    let cancelled = false;
    gameApp.init(config).then(() => {
      if (cancelled) return;
      // Initial render using store snapshot at time of mount
      const s = useGameStore.getState();
      gameApp.updateState(s.board, s.currentFigures, s.score, s.isMultiplierActive);
    });

    return () => {
      cancelled = true;
      gameApp.destroy();
      gameAppRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Keep Pixi in sync whenever board / figures / score change
  useEffect(() => {
    if (!gameAppRef.current) return;
    gameAppRef.current.updateState(board, currentFigures, score, isMultiplierActive);
  }, [board, currentFigures, score, isMultiplierActive]);

  // Keep the sound master toggle in sync with the applied config.
  useEffect(() => {
    soundManager.setEnabled(config.visual?.soundEnabled !== false);
  }, [config]);

  // Win / lose stingers.
  useEffect(() => {
    if (status === "won") soundManager.play("win");
    else if (status === "lost") soundManager.play("lose");
  }, [status]);

  return (
    <div className={styles.viewport}>
      {/* Pixi canvas mounts here */}
      <div ref={containerRef} className={styles.canvasContainer} />

      {/* Booster bar */}
      {showBoosters && (
        <div className={styles.boosterBar}>
          {config.boosters?.collectAll?.enabled && (
            <BoosterButton
              icon="🧹"
              label="Собрать всё"
              count={boosterInventory.collectAll}
              disabled={!isPlaying || boosterInventory.collectAll <= 0 || !hasFilledCells}
              onClick={handleCollectAll}
            />
          )}
          {config.boosters?.multiplier?.enabled && (
            <BoosterButton
              icon="✖️"
              label="Множитель"
              count={boosterInventory.multiplier}
              active={isMultiplierActive}
              disabled={
                !isPlaying || boosterInventory.multiplier <= 0 || isMultiplierActive
              }
              onClick={handleMultiplier}
            />
          )}
          {config.boosters?.hammer?.enabled && (
            <BoosterButton
              icon="🔨"
              label="Молоток"
              count={boosterInventory.hammer}
              active={isHammerSelecting}
              disabled={
                (!isPlaying && !isHammerSelecting) ||
                boosterInventory.hammer <= 0 ||
                (!hasFilledCells && !isHammerSelecting)
              }
              onClick={isHammerSelecting ? handleCancelHammer : handleHammer}
            />
          )}
        </div>
      )}

      {/* Hammer selection hint */}
      {isHammerSelecting && (
        <div className={styles.hammerHint}>
          <span>Выберите область 4×4 и подтвердите нажатием</span>
          <button className={styles.hammerCancel} onClick={handleCancelHammer}>
            Отмена
          </button>
        </div>
      )}

      {/* Victory overlay */}
      {status === "won" && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <h2 className={styles.overlayTitle}>🎉 Победа!</h2>
            <p className={styles.overlayText}>
              Очков набрано: <strong>{score}</strong>
            </p>
            <button
              className={styles.overlayButton}
              onClick={() => {
                const cfg = useGameStore.getState().config;
                if (cfg) initGame(cfg);
              }}
            >
              Играть заново
            </button>
          </div>
        </div>
      )}

      {/* Loss overlay */}
      {status === "lost" && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <h2 className={styles.overlayTitle}>😔 Поражение</h2>
            <p className={styles.overlayText}>
              Очков набрано: <strong>{score}</strong>
            </p>
            <button
              className={styles.overlayButton}
              onClick={() => {
                const cfg = useGameStore.getState().config;
                if (cfg) initGame(cfg);
              }}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}

      {/* Protection from loss overlay */}
      {status === "protection_from_loss" && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <h2 className={styles.overlayTitle}>
              ⚠️ {isBoardFull ? "Короб заполнен" : "Нет доступных ходов"}
            </h2>
            <p className={styles.overlayText}>
              Очистить поле и продолжить игру?
            </p>
            <div className={styles.overlayButtons}>
              <button
                className={styles.overlayButton}
                onClick={() => clearBoardAndContinue()}
              >
                Очистить поле и продолжить
              </button>
              <button
                className={`${styles.overlayButton} ${styles.overlayButtonSecondary}`}
                onClick={() => setStatus("lost")}
              >
                Завершить уровень
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type BoosterButtonProps = {
  icon: string;
  label: string;
  count: number;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
};

function BoosterButton({ icon, label, count, disabled, active, onClick }: BoosterButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.boosterButton} ${active ? styles.boosterButtonActive : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={`${label} (${count})`}
    >
      <span className={styles.boosterIcon}>{icon}</span>
      <span className={styles.boosterCount}>{count}</span>
    </button>
  );
}
