"use client";

import React from "react";
import { LevelConfig } from "@/entities/game/model/types";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

export default function VisualSection({ config, onChange }: Props) {
  const handleShowDebugChange = (showDebugGrid: boolean) => {
    onChange({ ...config, visual: { ...config.visual, showDebugGrid } });
  };

  return (
    <div className={styles.section}>
      <h3>Визуальное оформление</h3>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          id="showDebugGrid"
          checked={config.visual?.showDebugGrid === true}
          onChange={(e) => handleShowDebugChange(e.target.checked)}
        />
        <label htmlFor="showDebugGrid">Показывать сетку отладки (debug grid)</label>
      </div>
    </div>
  );
}
