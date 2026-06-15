"use client";

import React from "react";
import { LevelConfig } from "@/entities/game/model/types";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

export default function VisualSection({ config, onChange }: Props) {
  const handleVisualChange = (field: "backgroundId" | "cubeStyle", val: string) => {
    onChange({ ...config, visual: { ...config.visual, [field]: val } });
  };

  const handleShowDebugChange = (showDebugGrid: boolean) => {
    onChange({ ...config, visual: { ...config.visual, showDebugGrid } });
  };

  const handleVisualBoolChange = (field: "effectsEnabled" | "soundEnabled", val: boolean) => {
    onChange({ ...config, visual: { ...config.visual, [field]: val } });
  };

  return (
    <div className={styles.section}>
      <h3>Визуальное оформление</h3>
      <div className={styles.row}>
        <div className={styles.field}>
          <label>Идентификатор фона</label>
          <select
            value={config.visual?.backgroundId || "wood_classic"}
            onChange={(e) => handleVisualChange("backgroundId", e.target.value)}
          >
            <option value="wood_classic">Классическое дерево</option>
            <option value="wood_dark">Темное дерево</option>
            <option value="wood_royal">Королевское дерево</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>Стиль кубиков</label>
          <select
            value={config.visual?.cubeStyle || "pseudo3d"}
            onChange={(e) => handleVisualChange("cubeStyle", e.target.value)}
          >
            <option value="pseudo3d">Псевдо-3D</option>
          </select>
        </div>
      </div>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          id="showDebugGrid"
          checked={config.visual?.showDebugGrid === true}
          onChange={(e) => handleShowDebugChange(e.target.checked)}
        />
        <label htmlFor="showDebugGrid">Показывать сетку отладки (debug grid)</label>
      </div>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          id="effectsEnabled"
          checked={config.visual?.effectsEnabled !== false}
          onChange={(e) => handleVisualBoolChange("effectsEnabled", e.target.checked)}
        />
        <label htmlFor="effectsEnabled">Анимации и эффекты (левитация, частицы, bounce)</label>
      </div>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          id="soundEnabled"
          checked={config.visual?.soundEnabled !== false}
          onChange={(e) => handleVisualBoolChange("soundEnabled", e.target.checked)}
        />
        <label htmlFor="soundEnabled">Звуки (Howler)</label>
      </div>
    </div>
  );
}
