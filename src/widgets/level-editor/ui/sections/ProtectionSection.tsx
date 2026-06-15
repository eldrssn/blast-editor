"use client";

import React from "react";
import { LevelConfig } from "@/entities/game/model/types";
import styles from "../../styles/EditorForm.module.scss";

type Props = {
  config: LevelConfig;
  onChange: (config: LevelConfig) => void;
};

export default function ProtectionSection({ config, onChange }: Props) {
  const handleProtectionToggle = (enabled: boolean) => {
    onChange({ ...config, protectionFromLoss: { ...config.protectionFromLoss, enabled } });
  };

  return (
    <div className={styles.section}>
      <h3>Защита от поражения</h3>
      <div className={`${styles.field} ${styles.checkboxField}`}>
        <input
          type="checkbox"
          id="protection-enabled"
          checked={config.protectionFromLoss?.enabled !== false}
          onChange={(e) => handleProtectionToggle(e.target.checked)}
        />
        <label htmlFor="protection-enabled">Включить защиту при заполнении поля</label>
      </div>
    </div>
  );
}
