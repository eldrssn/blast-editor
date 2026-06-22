"use client";

import React from "react";
import { LevelConfig, BoardCellConfig, CubeColorId } from "@/entities/game/model/types";
import { CUBE_COLOR_IDS, getCubeAssetUrl } from "@/shared/lib/gameColors";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

const FALLBACK_COLORS: CubeColorId[] = [...CUBE_COLOR_IDS];

export default function InitialBoardSection({ config, onChange }: Props) {
  const boardColors: CubeColorId[] = config.figures?.colors?.length ? config.figures.colors : FALLBACK_COLORS;

  const [brushColorRaw, setBrushColor] = React.useState<CubeColorId>(boardColors[0]);

  // Keep the brush valid if the level's colour palette no longer contains it,
  // without an effect — derive the effective colour each render instead.
  const brushColor = boardColors.includes(brushColorRaw) ? brushColorRaw : boardColors[0];

  const boardRows = config.grid?.rows || 0;
  const boardCols = config.grid?.cols || 0;

  // Build a board snapshot sized to the current grid, preserving existing cells.
  // The form mutates grid.rows/cols independently of initialBoard, so we resize
  // defensively here instead of trusting the stored dimensions.
  const buildBoardSnapshot = (): Array<Array<BoardCellConfig | null>> => {
    const src = config.initialBoard || [];
    const board: Array<Array<BoardCellConfig | null>> = [];
    for (let r = 0; r < boardRows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      for (let c = 0; c < boardCols; c++) {
        const cell = src[r]?.[c];
        row.push(cell ? { ...cell } : null);
      }
      board.push(row);
    }
    return board;
  };

  const handleCellClick = (r: number, c: number) => {
    const board = buildBoardSnapshot();
    const existing = board[r][c];
    if (existing && existing.filled) {
      if (existing.color !== brushColor) {
        // Re-paint with the current brush instead of clearing.
        board[r][c] = { filled: true, color: brushColor };
      } else {
        board[r][c] = null;
      }
    } else {
      board[r][c] = { filled: true, color: brushColor };
    }
    onChange({ ...config, initialBoard: board });
  };

  const handleClearBoard = () => {
    const board = buildBoardSnapshot().map((row) => row.map(() => null));
    onChange({ ...config, initialBoard: board });
  };

  const handleFillBoard = () => {
    const board = buildBoardSnapshot().map((row) =>
      row.map<BoardCellConfig | null>(() => ({ filled: true, color: brushColor }))
    );
    onChange({ ...config, initialBoard: board });
  };

  return (
    <div className={styles.section}>
      <h3>Стартовое поле (Initial Board)</h3>
      <p className={styles.helpText}>
        Кликните по клетке, чтобы поставить/убрать стартовый блок. Повторный клик по блоку другого цвета
        перекрашивает его, тем же цветом — убирает.
      </p>

      {/* Brush controls */}
      <label className={styles.subLabel}>Цвет блока (кисть)</label>
      <div className={styles.swatchRow}>
        {boardColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setBrushColor(color)}
            title={color}
            className={`${styles.swatch} ${color === brushColor ? styles.swatchActive : ""}`}
            style={{ backgroundImage: `url(${getCubeAssetUrl(color)})` }}
          >
            <span className={styles.srOnly}>{color}</span>
          </button>
        ))}
      </div>

      {/* Interactive grid */}
      {boardRows > 0 && boardCols > 0 ? (
        <div className={styles.boardGrid} style={{ "--board-cols": boardCols } as React.CSSProperties}>
          {Array.from({ length: boardRows }).map((_, r) =>
            Array.from({ length: boardCols }).map((__, c) => {
              const cell = config.initialBoard?.[r]?.[c];
              const filled = !!cell?.filled;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  title={`[${r}, ${c}]`}
                  className={`${styles.boardCell} ${filled ? styles.boardCellFilled : ""}`}
                  style={filled && cell?.color ? { backgroundImage: `url(${getCubeAssetUrl(cell.color)})` } : undefined}
                />
              );
            })
          )}
        </div>
      ) : (
        <p className={styles.boardEmptyHint}>
          Задайте корректные размеры сетки (rows/cols), чтобы редактировать поле.
        </p>
      )}

      <div className={styles.boardActions}>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.smallBtn}`} onClick={handleClearBoard}>
          Очистить поле
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.smallBtn}`} onClick={handleFillBoard}>
          Заполнить кистью
        </button>
      </div>
    </div>
  );
}
