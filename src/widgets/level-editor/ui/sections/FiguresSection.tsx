"use client";

import React from "react";
import { LevelConfig } from "@/entities/game/model/types";
import FigurePreview from "../FigurePreview";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

// 15 standard shapes.
const SHAPE_IDS = Array.from({ length: 15 }, (_, i) => String(i + 1));

export default function FiguresSection({ config, onChange }: Props) {
  const handleShapeToggle = (shapeId: string, checked: boolean) => {
    const currentShapes = config.figures?.availableShapeIds || [];
    const nextWeights = { ...(config.figures?.spawnWeights || {}) };
    let nextShapes = [...currentShapes];
    if (checked) {
      if (!nextShapes.includes(shapeId)) {
        nextShapes.push(shapeId);
      }
      // Keep spawnWeights in sync so the newly enabled shape passes validation.
      if (nextWeights[shapeId] === undefined) {
        nextWeights[shapeId] = 10;
      }
    } else {
      nextShapes = nextShapes.filter((id) => id !== shapeId);
      delete nextWeights[shapeId];
    }

    onChange({
      ...config,
      figures: { ...config.figures, availableShapeIds: nextShapes, spawnWeights: nextWeights },
    });
  };

  const handleWeightChange = (shapeId: string, weight: number) => {
    onChange({
      ...config,
      figures: {
        ...config.figures,
        spawnWeights: { ...(config.figures?.spawnWeights || {}), [shapeId]: weight },
      },
    });
  };

  return (
    <div className={styles.section}>
      <h3>Доступные фигуры</h3>
      <label className={styles.subLabel}>Фигуры на уровне</label>
      <div className={styles.shapeGrid}>
        {SHAPE_IDS.map((id) => {
          const isChecked = config.figures?.availableShapeIds?.includes(id) || false;
          return (
            <label key={id} className={`${styles.shapeItem} ${isChecked ? styles.shapeItemActive : ""}`}>
              <input type="checkbox" checked={isChecked} onChange={(e) => handleShapeToggle(id, e.target.checked)} />
              <span className={styles.shapePreview}>
                <FigurePreview shapeId={id} color={isChecked ? "#3C70FF" : "#9aa4b2"} />
              </span>
              <span className={styles.shapeId}>#{id}</span>
            </label>
          );
        })}
      </div>

      <label className={`${styles.subLabel} ${styles.blockLabel}`}>Веса генерации (spawnWeights)</label>
      <p className={styles.helpText}>
        Чем выше вес, тем чаще выпадает фигура. Задаётся только для включённых фигур.
      </p>
      <div className={styles.weightGrid}>
        {(config.figures?.availableShapeIds || []).map((id) => (
          <div key={id} className={`${styles.field} ${styles.weightField}`}>
            <label className={styles.weightLabel}>
              <FigurePreview shapeId={id} cellSize={9} />
              <span>#{id}</span>
            </label>
            <input
              type="number"
              min={0}
              value={config.figures?.spawnWeights?.[id] ?? 0}
              onChange={(e) => handleWeightChange(id, parseInt(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
