"use client";

import React, { useState } from "react";
import { LevelConfig } from "@/entities/game/model/types";
import GameCore from "@/widgets/game-core/ui/GameCore";
import EditorForm from "@/widgets/level-editor/ui/EditorForm";
import { useLevelEditor } from "@/widgets/level-editor/model/useLevelEditor";
import styles from "../styles/HomeGameScreen.module.scss";

type HomeGameScreenProps = {
  initialLevel: LevelConfig;
};

export default function HomeGameScreen({ initialLevel }: HomeGameScreenProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  } = useLevelEditor(initialLevel);

  const handleApplyAndClose = () => {
    const isApplied = handleApply();
    if (isApplied) {
      setIsSettingsOpen(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <div className={styles.levelBadge}>Случайный уровень: {appliedConfig.levelId}</div>
        <button
          type="button"
          className={styles.settingsButton}
          onClick={() => setIsSettingsOpen(true)}
        >
          Настройки уровня
        </button>
      </div>

      <div className={styles.gameStage}>
        <GameCore config={appliedConfig} />
      </div>

      {isSettingsOpen && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Закрыть настройки"
            onClick={() => setIsSettingsOpen(false)}
          />

          <div className={styles.sheet}>
            <div className={styles.sheetHeader}>
              <div>
                <h2>Настройки уровня</h2>
                <p>Измените параметры и нажмите «Применить изменения».</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsSettingsOpen(false)}
              >
                Закрыть
              </button>
            </div>

            <div className={styles.sheetBody}>
              <EditorForm
                config={editConfig}
                onChange={handleConfigChange}
                errors={validationErrors}
                onApply={handleApplyAndClose}
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
          </div>
        </>
      )}

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
