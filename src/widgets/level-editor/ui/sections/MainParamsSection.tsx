"use client";

import React from "react";
import { LevelConfig, BoardCellConfig } from "@/entities/game/model/types";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

export default function MainParamsSection({ config, onChange }: Props) {
  const handleTextChange = (field: "levelId", val: string) => {
    onChange({ ...config, [field]: val });
  };

  const handleNumberChange = (field: "targetScore", val: number) => {
    onChange({ ...config, [field]: val });
  };

  const handleGridChange = (field: "rows" | "cols", val: number) => {
    const nextGrid = { ...config.grid, [field]: val };
    const rows = nextGrid.rows || 0;
    const cols = nextGrid.cols || 0;
    const src = config.initialBoard || [];

    // Resize initialBoard to match the new grid, preserving overlapping cells,
    // so the board stays consistent with validateLevelConfig.
    const nextBoard: Array<Array<BoardCellConfig | null>> = [];
    for (let r = 0; r < rows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      for (let c = 0; c < cols; c++) {
        const cell = src[r]?.[c];
        row.push(cell ? { ...cell } : null);
      }
      nextBoard.push(row);
    }

    onChange({ ...config, grid: nextGrid, initialBoard: nextBoard });
  };

  return (
    <div className={styles.section}>
      <h3>Основные параметры</h3>
      <div className={styles.row}>
        <div className={styles.field}>
          <label>ID уровня</label>
          <input type="text" value={config.levelId || ""} onChange={(e) => handleTextChange("levelId", e.target.value)} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label>Целевой счет (Вода)</label>
          <input
            type="number"
            value={config.targetScore || 0}
            onChange={(e) => handleNumberChange("targetScore", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <label>Сетка: Строки</label>
          <input
            type="number"
            value={config.grid?.rows || 0}
            onChange={(e) => handleGridChange("rows", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <label>Сетка: Столбцы</label>
          <input
            type="number"
            value={config.grid?.cols || 0}
            onChange={(e) => handleGridChange("cols", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}
