"use client";

import React from "react";
import { LevelConfig } from "@/entities/game/model/types";
import TemplateSection from "./sections/TemplateSection";
import MainParamsSection from "./sections/MainParamsSection";
import InitialBoardSection from "./sections/InitialBoardSection";
import FiguresSection from "./sections/FiguresSection";
import BoostersSection from "./sections/BoostersSection";
import ProtectionSection from "./sections/ProtectionSection";
import VisualSection from "./sections/VisualSection";
import JsonSection from "./sections/JsonSection";
import styles from "../styles/EditorForm.module.scss";

type EditorFormProps = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
  errors: string[];
  onApply: () => void;
  onReset: () => void;
  onCopyJson: () => void;
  onImportJson: (json: string) => void;
  jsonText: string;
  onJsonChange: (text: string) => void;
  jsonError: string | null;
  selectedTemplateId: string;
  onSelectedTemplateChange: (id: string) => void;
};

export default function EditorForm({
  config,
  onChange,
  errors,
  onApply,
  onReset,
  onCopyJson,
  onImportJson,
  jsonText,
  onJsonChange,
  jsonError,
  selectedTemplateId,
  onSelectedTemplateChange,
}: EditorFormProps) {
  return (
    <div className={styles.form}>
      <TemplateSection selectedTemplateId={selectedTemplateId} onSelectedTemplateChange={onSelectedTemplateChange} />
      <MainParamsSection config={config} onChange={onChange} />
      <InitialBoardSection config={config} onChange={onChange} />
      <FiguresSection config={config} onChange={onChange} />
      <BoostersSection config={config} onChange={onChange} />
      <ProtectionSection config={config} onChange={onChange} />
      <VisualSection config={config} onChange={onChange} />

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className={styles.errorsBlock}>
          <h4>⚠️ Ошибки валидации конфигурации</h4>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onApply}>
          Применить изменения
        </button>
        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onReset}>
          Сбросить
        </button>
      </div>

      <JsonSection
        jsonText={jsonText}
        jsonError={jsonError}
        onJsonChange={onJsonChange}
        onCopyJson={onCopyJson}
        onImportJson={onImportJson}
      />
    </div>
  );
}
