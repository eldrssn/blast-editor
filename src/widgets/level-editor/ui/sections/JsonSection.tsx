"use client";

import React from "react";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  jsonText: string;
  jsonError: string | null;
  onJsonChange: (text: string) => void;
  onCopyJson: () => void;
  onImportJson: (json: string) => void;
};

export default function JsonSection({ jsonText, jsonError, onJsonChange, onCopyJson, onImportJson }: Props) {
  return (
    <div className={`${styles.section} ${styles.jsonBlock}`}>
      <div className={styles.jsonHeader}>
        <span>JSON Конфигурация уровня</span>
        <button className={`${styles.btn} ${styles.btnSecondary} ${styles.smallBtn}`} onClick={onCopyJson}>
          Копировать JSON
        </button>
      </div>
      <div className={styles.field}>
        <textarea
          value={jsonText}
          onChange={(e) => onJsonChange(e.target.value)}
          placeholder="Вставьте JSON конфигурацию здесь"
          style={jsonError ? { borderColor: "#ef4444" } : undefined}
        />
      </div>
      {jsonError && (
        <div className={styles.errorsBlock} style={{ marginTop: "0.5rem" }}>
          <h4>⚠️ Невалидный JSON</h4>
          <ul>
            <li>{jsonError}</li>
          </ul>
        </div>
      )}
      <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: "100%" }} onClick={() => onImportJson(jsonText)}>
        Импортировать JSON
      </button>
    </div>
  );
}
