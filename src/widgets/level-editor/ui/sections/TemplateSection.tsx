"use client";

import React from "react";
import { DEFAULT_LEVELS } from "@/entities/game/config/defaultLevels";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  selectedTemplateId: string;
  onSelectedTemplateChange: (id: string) => void;
};

export default function TemplateSection({ selectedTemplateId, onSelectedTemplateChange }: Props) {
  return (
    <div className={`${styles.section} ${styles.presetSelect}`}>
      <h3>Шаблон уровня</h3>
      <div className={styles.field}>
        <label>Выбрать из заготовок</label>
        <select value={selectedTemplateId} onChange={(e) => onSelectedTemplateChange(e.target.value)}>
          <option value="custom">Пользовательский (без шаблона)</option>
          {DEFAULT_LEVELS.map((level) => (
            <option key={level.levelId} value={level.levelId}>
              {level.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
