"use client";

import React, { useState, useMemo } from "react";
import { LevelConfig } from "@/entities/game/model/types";
import { DEFAULT_LEVELS } from "@/entities/game/config/defaultLevels";
import { normalizeLevelConfig } from "@/entities/game/model/normalize";
import { validateLevelConfig } from "@/entities/game/model/validation";
import EditorForm from "./EditorForm";
import GameCore from "@/widgets/game-core/ui/GameCore";
import styles from "../styles/LevelEditor.module.scss";

export default function LevelEditor() {
  const initialLevel = DEFAULT_LEVELS[0];
  const [editConfig, setEditConfig] = useState<LevelConfig>(() => normalizeLevelConfig(initialLevel));
  const [appliedConfig, setAppliedConfig] = useState<LevelConfig>(() => normalizeLevelConfig(initialLevel));
  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(normalizeLevelConfig(initialLevel), null, 2));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialLevel.levelId);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Validation is a pure function of the edited config — derive it during render
  // instead of mirroring it into state via an effect (avoids cascading renders).
  const validationErrors = useMemo(() => validateLevelConfig(editConfig), [editConfig]);

  // Apply a new config from the form/template/import and re-sync the textarea.
  // (JSON typed by hand uses setEditConfig directly so the raw text isn't reformatted.)
  const applyEditConfig = (cfg: LevelConfig) => {
    setEditConfig(cfg);
    setJsonText(JSON.stringify(cfg, null, 2));
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    if (id === "custom") return;

    const template = DEFAULT_LEVELS.find((l) => l.levelId === id);
    if (template) {
      const normalized = normalizeLevelConfig(template);
      applyEditConfig(normalized);
      setAppliedConfig(normalized);
    }
  };

  const handleConfigChange = (newConfig: LevelConfig) => {
    applyEditConfig(newConfig);
  };

  const handleApply = () => {
    if (validationErrors.length === 0) {
      setAppliedConfig(JSON.parse(JSON.stringify(editConfig)));
      alert("Конфигурация успешно применена к игре!");
    } else {
      alert("Не удалось применить конфигурацию. Проверьте ошибки валидации.");
    }
  };

  const handleReset = () => {
    if (selectedTemplateId !== "custom") {
      const template = DEFAULT_LEVELS.find((l) => l.levelId === selectedTemplateId);
      if (template) {
        const normalized = normalizeLevelConfig(template);
        applyEditConfig(normalized);
        setAppliedConfig(normalized);
      }
    } else {
      const normalized = normalizeLevelConfig(initialLevel);
      applyEditConfig(normalized);
      setAppliedConfig(normalized);
      setSelectedTemplateId(initialLevel.levelId);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(editConfig, null, 2))
      .then(() => alert("JSON скопирован в буфер обмена!"))
      .catch(() => alert("Не удалось скопировать JSON."));
  };

  const handleImportJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizeLevelConfig(parsed);
      const errors = validateLevelConfig(normalized);

      setJsonError(null);
      applyEditConfig(normalized);

      if (errors.length === 0) {
        setAppliedConfig(normalized);
        setSelectedTemplateId("custom");
        alert("Конфигурация успешно импортирована!");
      } else {
        alert("Конфигурация импортирована, но содержит ошибки валидации.");
      }
    } catch (e) {
      setJsonError("Ошибка при парсинге JSON: " + (e as Error).message);
      alert("Ошибка при парсинге JSON: " + (e as Error).message);
    }
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizeLevelConfig(parsed);
      setJsonError(null);
      // Keep the raw text the user is typing — only update the parsed config.
      setEditConfig(normalized);
    } catch (e) {
      // Invalid JSON syntax: keep the raw text, surface the error, don't touch config.
      setJsonError((e as Error).message);
    }
  };

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
    </div>
  );
}
