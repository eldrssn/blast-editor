"use client";

import React from "react";
import EditorForm from "./EditorForm";
import GameCore from "@/widgets/game-core/ui/GameCore";
import { useLevelEditor } from "../model/useLevelEditor";
import styles from "../styles/LevelEditor.module.scss";

export default function LevelEditor() {
  const {
    editConfig,
    appliedConfig,
    jsonText,
    jsonError,
    selectedTemplateId,
    validationErrors,
    toast,
    handleConfigChange,
    handleApply,
    handleReset,
    handleCopyJson,
    handleImportJson,
    handleJsonChange,
    handleTemplateChange,
  } = useLevelEditor();

  return (
    <div className={styles.container}>
      <div className={styles.editorPane}>
        <div className={styles.header}>
          <div>
            <h1>Редактор уровней</h1>
            <p className={styles.subtitle}>Создание и настройка уровней для Block Blast Core</p>
          </div>
        </div>

        <EditorForm
          config={editConfig}
          onChange={handleConfigChange}
          errors={validationErrors}
          onApply={handleApply}
          onReset={handleReset}
          onCopyJson={handleCopyJson}
          onImportJson={handleImportJson}
          jsonText={jsonText}
          onJsonChange={handleJsonChange}
          jsonError={jsonError}
          selectedTemplateId={selectedTemplateId}
          onSelectedTemplateChange={handleTemplateChange}
        />
      </div>

      <div className={styles.previewPane}>
        <GameCore config={appliedConfig} />
      </div>

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
