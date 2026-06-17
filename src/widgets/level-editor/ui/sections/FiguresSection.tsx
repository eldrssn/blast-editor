"use client";

import React from "react";
import { LevelConfig, ScriptedFigure } from "@/entities/game/model/types";
import FigurePreview from "../FigurePreview";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

// 15 standard shapes.
const SHAPE_IDS = Array.from({ length: 15 }, (_, i) => String(i + 1));

// Up to 3 scripted opening sets (3 figures each).
const MAX_SCRIPTED_SETS = 3;
const SET_OPTIONS = [0, 1, 2, 3];
// Scripted slot previews use a neutral grey — the spawned colour is always random.
const SCRIPTED_PREVIEW_COLOR = "#9aa4b2";

export default function FiguresSection({ config, onChange }: Props) {
  const handleShapeToggle = (shapeId: string, checked: boolean) => {
    const currentShapes = config.figures?.availableShapeIds || [];
    const nextWeights = { ...(config.figures?.spawnWeights || {}) };
    let nextShapes = [...currentShapes];
    let nextScripted = config.figures?.scriptedOpening;
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
      // Drop the shape from the scripted opening — a removed shape can't be pinned.
      if (nextScripted?.some((e) => e.shapeId === shapeId)) {
        nextScripted = nextScripted.map((e) => (e.shapeId === shapeId ? {} : e));
      }
    }

    onChange({
      ...config,
      figures: {
        ...config.figures,
        availableShapeIds: nextShapes,
        spawnWeights: nextWeights,
        ...(nextScripted !== undefined ? { scriptedOpening: nextScripted } : {}),
      },
    });
  };

  const availableShapeIds = config.figures?.availableShapeIds || [];
  const scripted: ScriptedFigure[] = config.figures?.scriptedOpening || [];
  const scriptedSets = Math.ceil(scripted.length / 3);

  const writeScripted = (next: ScriptedFigure[] | undefined) => {
    const figures = { ...config.figures };
    if (next && next.length > 0) {
      figures.scriptedOpening = next;
    } else {
      delete figures.scriptedOpening;
    }
    onChange({ ...config, figures });
  };

  const handleSetsCountChange = (sets: number) => {
    if (sets <= 0) {
      writeScripted(undefined);
      return;
    }
    const length = sets * 3;
    const next: ScriptedFigure[] = Array.from({ length }, (_, i) => scripted[i] || {});
    writeScripted(next);
  };

  const handleSlotChange = (index: number, shapeId: string) => {
    const next = scripted.map((e) => ({ ...e }));
    while (next.length <= index) next.push({});
    next[index] = shapeId ? { shapeId } : {};
    writeScripted(next);
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

      <label className={`${styles.subLabel} ${styles.blockLabel}`}>Стартовые фигуры (скрипт)</label>
      <p className={styles.helpText}>
        Можно жёстко задать порядок фигур на первые наборы. «Случайно» в слоте — фигура выпадет
        по весам. Цвет всегда случайный. Заданы только первые наборы, дальше спавн обычный.
      </p>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <label>Заданных наборов:</label>
        <select
          value={Math.min(scriptedSets, MAX_SCRIPTED_SETS)}
          onChange={(e) => handleSetsCountChange(parseInt(e.target.value) || 0)}
        >
          {SET_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "Нет (случайно)" : `${n} (${n * 3} фигур)`}
            </option>
          ))}
        </select>
      </div>
      {scriptedSets > 0 &&
        Array.from({ length: scriptedSets }, (_, s) => (
          <div key={s} className={styles.scriptedSet}>
            <span className={styles.scriptedSetTitle}>Набор {s + 1}</span>
            <div className={styles.scriptedGrid}>
              {[0, 1, 2].map((i) => {
                const index = s * 3 + i;
                const value = scripted[index]?.shapeId || "";
                return (
                  <div key={i} className={styles.scriptedSlot}>
                    <span className={styles.shapePreview} title="Цвет фигуры всегда случайный">
                      {value ? (
                        // Neutral grey, not a real colour: the spawned colour is always random.
                        <FigurePreview shapeId={value} color={SCRIPTED_PREVIEW_COLOR} />
                      ) : (
                        <span className={styles.scriptedRandom}>?</span>
                      )}
                    </span>
                    <select value={value} onChange={(e) => handleSlotChange(index, e.target.value)}>
                      <option value="">Случайно</option>
                      {availableShapeIds.map((id) => (
                        <option key={id} value={id}>
                          #{id}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
