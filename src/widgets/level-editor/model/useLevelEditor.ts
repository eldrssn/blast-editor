"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LevelConfig } from "@/entities/game/model/types";
import { DEFAULT_LEVELS } from "@/entities/game/config/defaultLevels";
import { normalizeLevelConfig } from "@/entities/game/model/normalize";
import { validateLevelConfig } from "@/entities/game/model/validation";

function cloneLevelConfig(config: LevelConfig): LevelConfig {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(config);
  }

  // LevelConfig is kept JSON-serializable, so JSON clone is a safe fallback
  // for older Android WebViews that don't implement structuredClone.
  return JSON.parse(JSON.stringify(config)) as LevelConfig;
}

/**
 * State + handlers for the level editor, kept out of the LevelEditor view so the
 * widget only wires data into the form/preview. Owns the edited config, the
 * applied config (what the preview runs), the raw JSON mirror and the selected
 * template, plus all the apply/reset/import/export transitions between them.
 */
function getTemplateSelectionId(levelId: string) {
  return DEFAULT_LEVELS.some((level) => level.levelId === levelId) ? levelId : "custom";
}

export function useLevelEditor(initialLevel: LevelConfig = DEFAULT_LEVELS[0]) {
  const normalizedInitialLevel = useMemo(
    () => normalizeLevelConfig(initialLevel),
    [initialLevel]
  );
  const [editConfig, setEditConfig] = useState<LevelConfig>(normalizedInitialLevel);
  const [appliedConfig, setAppliedConfig] = useState<LevelConfig>(normalizedInitialLevel);
  const [jsonText, setJsonText] = useState<string>(() => JSON.stringify(normalizedInitialLevel, null, 2));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    getTemplateSelectionId(normalizedInitialLevel.levelId)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Lightweight inline toast (replaces blocking alert() calls).
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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
      setJsonError(null);
    }
  };

  const handleConfigChange = (newConfig: LevelConfig) => {
    applyEditConfig(newConfig);
  };

  const handleApply = () => {
    if (validationErrors.length === 0) {
      setAppliedConfig(cloneLevelConfig(editConfig));
      notify("success", "Конфигурация применена к игре");
      return true;
    }

    notify("error", "Проверьте ошибки валидации конфигурации");
    return false;
  };

  const handleReset = () => {
    const restoredConfig = cloneLevelConfig(appliedConfig);
    applyEditConfig(restoredConfig);
    setSelectedTemplateId(getTemplateSelectionId(restoredConfig.levelId));
    setJsonError(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(editConfig, null, 2))
      .then(() => notify("success", "JSON скопирован в буфер обмена"))
      .catch(() => notify("error", "Не удалось скопировать JSON"));
  };

  const handleImportJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizeLevelConfig(parsed);
      const errors = validateLevelConfig(normalized);

      setJsonError(null);
      setSelectedTemplateId("custom");
      applyEditConfig(normalized);

      if (errors.length === 0) {
        notify("success", "Конфигурация импортирована в редактор");
      } else {
        notify("error", "Импортировано, но есть ошибки валидации");
      }
    } catch (e) {
      const message = "Ошибка при парсинге JSON: " + (e as Error).message;
      setJsonError(message);
      notify("error", "Невалидный JSON");
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

  return {
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
  };
}
