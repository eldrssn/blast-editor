"use client";

import React from "react";
import { LevelConfig, BoosterType } from "@/entities/game/model/types";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

export default function BoostersSection({ config, onChange }: Props) {
  const handleBoosterToggle = (type: BoosterType, enabled: boolean) => {
    onChange({
      ...config,
      boosters: { ...config.boosters, [type]: { ...config.boosters[type], enabled } },
    });
  };

  const handleBoosterCountChange = (type: BoosterType, count: number) => {
    onChange({
      ...config,
      boosters: { ...config.boosters, [type]: { ...config.boosters[type], initialCount: count } },
    });
  };

  const handleMultiplierValChange = (val: number) => {
    onChange({
      ...config,
      boosters: { ...config.boosters, multiplier: { ...config.boosters.multiplier, multiplierValue: val } },
    });
  };

  return (
    <div className={styles.section}>
      <h3>Настройка бустеров</h3>

      {/* Collect All */}
      <div className={styles.boosterRow}>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="collectAll-enabled"
            checked={config.boosters?.collectAll?.enabled !== false}
            onChange={(e) => handleBoosterToggle("collectAll", e.target.checked)}
          />
          <label htmlFor="collectAll-enabled">Бустер &quot;Собрать все&quot;</label>
        </div>
        {config.boosters?.collectAll?.enabled !== false && (
          <div className={`${styles.field} ${styles.indentRow}`}>
            <label>Количество зарядов</label>
            <input
              type="number"
              value={config.boosters?.collectAll?.initialCount ?? 0}
              onChange={(e) => handleBoosterCountChange("collectAll", parseInt(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Multiplier */}
      <div className={styles.boosterRow}>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="multiplier-enabled"
            checked={config.boosters?.multiplier?.enabled !== false}
            onChange={(e) => handleBoosterToggle("multiplier", e.target.checked)}
          />
          <label htmlFor="multiplier-enabled">Бустер &quot;Множитель&quot;</label>
        </div>
        {config.boosters?.multiplier?.enabled !== false && (
          <div className={`${styles.row} ${styles.indentRow}`}>
            <div className={styles.field}>
              <label>Количество зарядов</label>
              <input
                type="number"
                value={config.boosters?.multiplier?.initialCount ?? 0}
                onChange={(e) => handleBoosterCountChange("multiplier", parseInt(e.target.value) || 0)}
              />
            </div>
            <div className={styles.field}>
              <label>Множитель (x)</label>
              <input
                type="number"
                step="0.5"
                value={config.boosters?.multiplier?.multiplierValue ?? 2}
                onChange={(e) => handleMultiplierValChange(parseFloat(e.target.value) || 2)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hammer */}
      <div>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="hammer-enabled"
            checked={config.boosters?.hammer?.enabled !== false}
            onChange={(e) => handleBoosterToggle("hammer", e.target.checked)}
          />
          <label htmlFor="hammer-enabled">Бустер &quot;Молоток&quot;</label>
        </div>
        {config.boosters?.hammer?.enabled !== false && (
          <div className={`${styles.row} ${styles.indentRow}`}>
            <div className={styles.field}>
              <label>Количество зарядов</label>
              <input
                type="number"
                value={config.boosters?.hammer?.initialCount ?? 0}
                onChange={(e) => handleBoosterCountChange("hammer", parseInt(e.target.value) || 0)}
              />
            </div>
            <div className={styles.field}>
              <label>Зона действия</label>
              <input type="text" value="4 × 4 (фиксировано)" disabled readOnly />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
