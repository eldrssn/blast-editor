"use client";

import React from "react";
import { LevelConfig, BoosterType, BoardCellConfig } from "@/entities/game/model/types";
import { DEFAULT_LEVELS } from "@/entities/game/config/defaultLevels";
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
  onSelectedTemplateChange
}: EditorFormProps) {
  
  // Handlers for form inputs
  const handleTextChange = (field: keyof LevelConfig, val: string) => {
    onChange({
      ...config,
      [field]: val
    });
  };

  const handleGridChange = (field: "rows" | "cols", val: number) => {
    const nextGrid = { ...config.grid, [field]: val };
    const rows = nextGrid.rows || 0;
    const cols = nextGrid.cols || 0;
    const src = config.initialBoard || [];

    // Resize initialBoard to match the new grid, preserving overlapping cells,
    // so the board stays consistent with validateLevelConfig.
    const nextBoard: Array<Array<BoardCellConfig | null>> = [];
    for (let r = 0; r < rows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      for (let c = 0; c < cols; c++) {
        const cell = src[r]?.[c];
        row.push(cell ? { ...cell } : null);
      }
      nextBoard.push(row);
    }

    onChange({
      ...config,
      grid: nextGrid,
      initialBoard: nextBoard
    });
  };

  const handleNumberChange = (field: keyof LevelConfig, val: number) => {
    onChange({
      ...config,
      [field]: val
    });
  };

  const handleBoosterToggle = (type: BoosterType, enabled: boolean) => {
    onChange({
      ...config,
      boosters: {
        ...config.boosters,
        [type]: {
          ...config.boosters[type],
          enabled
        }
      }
    });
  };

  const handleBoosterCountChange = (type: BoosterType, count: number) => {
    onChange({
      ...config,
      boosters: {
        ...config.boosters,
        [type]: {
          ...config.boosters[type],
          initialCount: count
        }
      }
    });
  };

  const handleHammerSizeChange = (field: "areaRows" | "areaCols", val: number) => {
    onChange({
      ...config,
      boosters: {
        ...config.boosters,
        hammer: {
          ...config.boosters.hammer,
          [field]: val
        }
      }
    });
  };

  const handleMultiplierValChange = (val: number) => {
    onChange({
      ...config,
      boosters: {
        ...config.boosters,
        multiplier: {
          ...config.boosters.multiplier,
          multiplierValue: val
        }
      }
    });
  };

  const handleProtectionToggle = (enabled: boolean) => {
    onChange({
      ...config,
      protectionFromLoss: {
        ...config.protectionFromLoss,
        enabled
      }
    });
  };

  const handleProtectionCostChange = (clearBoardCost: number) => {
    onChange({
      ...config,
      protectionFromLoss: {
        ...config.protectionFromLoss,
        clearBoardCost
      }
    });
  };

  const handleVisualChange = (field: "backgroundId" | "cubeStyle", val: string) => {
    onChange({
      ...config,
      visual: {
        ...config.visual,
        [field]: val
      }
    });
  };

  const handleShowDebugChange = (showDebugGrid: boolean) => {
    onChange({
      ...config,
      visual: {
        ...config.visual,
        showDebugGrid
      }
    });
  };

  const handleVisualBoolChange = (field: "effectsEnabled" | "soundEnabled", val: boolean) => {
    onChange({
      ...config,
      visual: {
        ...config.visual,
        [field]: val
      }
    });
  };

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
      nextShapes = nextShapes.filter(id => id !== shapeId);
      delete nextWeights[shapeId];
    }

    onChange({
      ...config,
      figures: {
        ...config.figures,
        availableShapeIds: nextShapes,
        spawnWeights: nextWeights
      }
    });
  };

  const handleWeightChange = (shapeId: string, weight: number) => {
    onChange({
      ...config,
      figures: {
        ...config.figures,
        spawnWeights: {
          ...(config.figures?.spawnWeights || {}),
          [shapeId]: weight
        }
      }
    });
  };

  // --- Initial board editor ---------------------------------------------
  const boardColors = config.figures?.colors?.length
    ? config.figures.colors
    : ["#FF708A", "#3CD070", "#3C70FF", "#F59E0B", "#B070FF"];

  const [brushColorRaw, setBrushColor] = React.useState<string>(boardColors[0]);
  const [brushWater, setBrushWater] = React.useState<boolean>(false);

  // Keep the brush valid if the level's colour palette no longer contains it,
  // without an effect — derive the effective colour each render instead.
  const brushColor = boardColors.includes(brushColorRaw) ? brushColorRaw : boardColors[0];

  // Build a board snapshot sized to the current grid, preserving existing cells.
  // The form mutates grid.rows/cols independently of initialBoard, so we resize
  // defensively here instead of trusting the stored dimensions.
  const buildBoardSnapshot = (): Array<Array<BoardCellConfig | null>> => {
    const rows = config.grid?.rows || 0;
    const cols = config.grid?.cols || 0;
    const src = config.initialBoard || [];
    const board: Array<Array<BoardCellConfig | null>> = [];
    for (let r = 0; r < rows; r++) {
      const row: Array<BoardCellConfig | null> = [];
      for (let c = 0; c < cols; c++) {
        const cell = src[r]?.[c];
        row.push(cell ? { ...cell } : null);
      }
      board.push(row);
    }
    return board;
  };

  const handleCellClick = (r: number, c: number) => {
    const board = buildBoardSnapshot();
    const existing = board[r][c];
    if (existing && existing.filled) {
      if (existing.color !== brushColor || !!existing.hasWater !== brushWater) {
        // Re-paint with the current brush instead of clearing.
        board[r][c] = { filled: true, color: brushColor, hasWater: brushWater };
      } else {
        board[r][c] = null;
      }
    } else {
      board[r][c] = { filled: true, color: brushColor, hasWater: brushWater };
    }
    onChange({ ...config, initialBoard: board });
  };

  const handleClearBoard = () => {
    const board = buildBoardSnapshot().map((row) => row.map(() => null));
    onChange({ ...config, initialBoard: board });
  };

  const handleFillBoard = () => {
    const board = buildBoardSnapshot().map((row) =>
      row.map<BoardCellConfig | null>(() => ({ filled: true, color: brushColor, hasWater: brushWater }))
    );
    onChange({ ...config, initialBoard: board });
  };

  const boardRows = config.grid?.rows || 0;
  const boardCols = config.grid?.cols || 0;

  // 15 Standard Shapes
  const shapeIds = Array.from({ length: 15 }, (_, i) => String(i + 1));

  return (
    <div className={styles.form}>
      {/* Template selector */}
      <div className={`${styles.section} ${styles.presetSelect}`}>
        <h3>Шаблон уровня</h3>
        <div className={styles.field}>
          <label>Выбрать из заготовок</label>
          <select 
            value={selectedTemplateId} 
            onChange={(e) => onSelectedTemplateChange(e.target.value)}
          >
            <option value="custom">Пользовательский (без шаблона)</option>
            {DEFAULT_LEVELS.map(level => (
              <option key={level.levelId} value={level.levelId}>
                {level.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Parameters */}
      <div className={styles.section}>
        <h3>Основные параметры</h3>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>ID уровня</label>
            <input 
              type="text" 
              value={config.levelId || ""} 
              onChange={(e) => handleTextChange("levelId", e.target.value)} 
            />
          </div>
          <div className={styles.field}>
            <label>Название уровня</label>
            <input 
              type="text" 
              value={config.title || ""} 
              onChange={(e) => handleTextChange("title", e.target.value)} 
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Целевой счет (Вода)</label>
            <input 
              type="number" 
              value={config.targetScore || 0} 
              onChange={(e) => handleNumberChange("targetScore", parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className={styles.field}>
            <label>Сетка: Строки</label>
            <input 
              type="number" 
              value={config.grid?.rows || 0} 
              onChange={(e) => handleGridChange("rows", parseInt(e.target.value) || 0)} 
            />
          </div>
          <div className={styles.field}>
            <label>Сетка: Столбцы</label>
            <input 
              type="number" 
              value={config.grid?.cols || 0} 
              onChange={(e) => handleGridChange("cols", parseInt(e.target.value) || 0)} 
            />
          </div>
        </div>
      </div>

      {/* Initial Board Editor */}
      <div className={styles.section}>
        <h3>Стартовое поле (Initial Board)</h3>
        <p style={{ fontSize: "0.75rem", color: "#78716c", margin: "0 0 0.75rem" }}>
          Кликните по клетке, чтобы поставить/убрать стартовый блок. Повторный клик
          по блоку другого цвета перекрашивает его, тем же цветом — убирает.
        </p>

        {/* Brush controls */}
        <label style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: 600, textTransform: "uppercase" }}>
          Цвет блока (кисть)
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0.375rem 0 0.75rem" }}>
          {boardColors.map((color) => {
            const active = color === brushColor;
            return (
              <button
                key={color}
                type="button"
                onClick={() => setBrushColor(color)}
                title={color}
                style={{
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: "6px",
                  background: color,
                  cursor: "pointer",
                  border: active ? "2px solid #fff" : "2px solid rgba(0,0,0,0.3)",
                  boxShadow: active ? "0 0 0 2px #e6c687" : "none"
                }}
              />
            );
          })}
        </div>

        <div className={`${styles.field} ${styles.checkboxField}`} style={{ marginBottom: "0.75rem" }}>
          <input
            type="checkbox"
            id="brush-water"
            checked={brushWater}
            onChange={(e) => setBrushWater(e.target.checked)}
          />
          <label htmlFor="brush-water">Блок с водой (hasWater) 💧</label>
        </div>

        {/* Interactive grid */}
        {boardRows > 0 && boardCols > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${boardCols}, 1fr)`,
              gap: "3px",
              padding: "6px",
              background: "rgba(0,0,0,0.25)",
              borderRadius: "8px",
              maxWidth: "320px"
            }}
          >
            {Array.from({ length: boardRows }).map((_, r) =>
              Array.from({ length: boardCols }).map((__, c) => {
                const cell = config.initialBoard?.[r]?.[c];
                const filled = !!cell?.filled;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => handleCellClick(r, c)}
                    title={`[${r}, ${c}]`}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: "4px",
                      cursor: "pointer",
                      background: filled ? cell?.color || "#FF708A" : "rgba(255,255,255,0.05)",
                      border: filled ? "1px solid rgba(0,0,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: filled ? "inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.25)" : "none",
                      position: "relative",
                      padding: 0,
                      fontSize: "0.7rem",
                      lineHeight: 1
                    }}
                  >
                    {filled && cell?.hasWater ? "💧" : ""}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>
            Задайте корректные размеры сетки (rows/cols), чтобы редактировать поле.
          </p>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem", height: "auto" }}
            onClick={handleClearBoard}
          >
            Очистить поле
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8rem", height: "auto" }}
            onClick={handleFillBoard}
          >
            Заполнить кистью
          </button>
        </div>
      </div>

      {/* Available Figures */}
      <div className={styles.section}>
        <h3>Доступные фигуры</h3>
        <label style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: "600", textTransform: "uppercase" }}>
          Фигуры на уровне
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginTop: "0.25rem" }}>
          {shapeIds.map(id => {
            const isChecked = config.figures?.availableShapeIds?.includes(id) || false;
            return (
              <label 
                key={id} 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "0.25rem", 
                  fontSize: "0.875rem", 
                  cursor: "pointer",
                  background: isChecked ? "rgba(230, 198, 135, 0.15)" : "rgba(0,0,0,0.2)",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "6px",
                  border: isChecked ? "1px solid #e6c687" : "1px solid rgba(255,255,255,0.05)"
                }}
              >
                <input 
                  type="checkbox" 
                  checked={isChecked}
                  onChange={(e) => handleShapeToggle(id, e.target.checked)}
                />
                <span>#{id}</span>
              </label>
            );
          })}
        </div>

        <label style={{ fontSize: "0.75rem", color: "#a8a29e", fontWeight: "600", textTransform: "uppercase", display: "block", marginTop: "1rem" }}>
          Веса генерации (spawnWeights)
        </label>
        <p style={{ fontSize: "0.75rem", color: "#78716c", margin: "0.25rem 0 0.5rem" }}>
          Чем выше вес, тем чаще выпадает фигура. Задаётся только для включённых фигур.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
          {(config.figures?.availableShapeIds || []).map(id => (
            <div key={id} className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ minWidth: "2.25rem" }}>#{id}</label>
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

      {/* Boosters Settings */}
      <div className={styles.section}>
        <h3>Настройка бустеров</h3>
        
        {/* Collect All */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
          <div className={`${styles.field} ${styles.checkboxField}`}>
            <input 
              type="checkbox" 
              id="collectAll-enabled"
              checked={config.boosters?.collectAll?.enabled !== false} 
              onChange={(e) => handleBoosterToggle("collectAll", e.target.checked)}
            />
            <label htmlFor="collectAll-enabled">Бустер &quot;Собрать все&quot;</label>
          </div>
          {config.boosters?.collectAll?.enabled !== false && (
            <div className={styles.field} style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
              <label>Количество зарядов</label>
              <input 
                type="number" 
                value={config.boosters?.collectAll?.initialCount ?? 0}
                onChange={(e) => handleBoosterCountChange("collectAll", parseInt(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {/* Multiplier */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
          <div className={`${styles.field} ${styles.checkboxField}`}>
            <input 
              type="checkbox" 
              id="multiplier-enabled"
              checked={config.boosters?.multiplier?.enabled !== false} 
              onChange={(e) => handleBoosterToggle("multiplier", e.target.checked)}
            />
            <label htmlFor="multiplier-enabled">Бустер &quot;Множитель&quot;</label>
          </div>
          {config.boosters?.multiplier?.enabled !== false && (
            <div className={styles.row} style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
              <div className={styles.field}>
                <label>Количество зарядов</label>
                <input 
                  type="number" 
                  value={config.boosters?.multiplier?.initialCount ?? 0}
                  onChange={(e) => handleBoosterCountChange("multiplier", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className={styles.field}>
                <label>Множитель (x)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={config.boosters?.multiplier?.multiplierValue ?? 2}
                  onChange={(e) => handleMultiplierValChange(parseFloat(e.target.value) || 2)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hammer */}
        <div>
          <div className={`${styles.field} ${styles.checkboxField}`}>
            <input 
              type="checkbox" 
              id="hammer-enabled"
              checked={config.boosters?.hammer?.enabled !== false} 
              onChange={(e) => handleBoosterToggle("hammer", e.target.checked)}
            />
            <label htmlFor="hammer-enabled">Бустер &quot;Молоток&quot;</label>
          </div>
          {config.boosters?.hammer?.enabled !== false && (
            <div className={styles.row} style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
              <div className={styles.field}>
                <label>Количество зарядов</label>
                <input 
                  type="number" 
                  value={config.boosters?.hammer?.initialCount ?? 0}
                  onChange={(e) => handleBoosterCountChange("hammer", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className={styles.field}>
                <label>Зона: Высота</label>
                <input 
                  type="number" 
                  value={config.boosters?.hammer?.areaRows ?? 4}
                  onChange={(e) => handleHammerSizeChange("areaRows", parseInt(e.target.value) || 4)}
                />
              </div>
              <div className={styles.field}>
                <label>Зона: Ширина</label>
                <input 
                  type="number" 
                  value={config.boosters?.hammer?.areaCols ?? 4}
                  onChange={(e) => handleHammerSizeChange("areaCols", parseInt(e.target.value) || 4)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loss Protection */}
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
        {config.protectionFromLoss?.enabled !== false && (
          <div className={styles.field} style={{ paddingLeft: "1.5rem" }}>
            <label>Стоимость очистки поля (Вода/Очки)</label>
            <input 
              type="number" 
              value={config.protectionFromLoss?.clearBoardCost ?? 0}
              onChange={(e) => handleProtectionCostChange(parseInt(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Visual Settings */}
      <div className={styles.section}>
        <h3>Визуальное оформление</h3>
        <div className={styles.row}>
          <div className={styles.field}>
            <label>Идентификатор фона</label>
            <select 
              value={config.visual?.backgroundId || "wood_classic"} 
              onChange={(e) => handleVisualChange("backgroundId", e.target.value)}
            >
              <option value="wood_classic">Классическое дерево</option>
              <option value="wood_dark">Темное дерево</option>
              <option value="wood_royal">Королевское дерево</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Стиль кубиков</label>
            <select 
              value={config.visual?.cubeStyle || "pseudo3d"} 
              onChange={(e) => handleVisualChange("cubeStyle", e.target.value)}
            >
              <option value="pseudo3d">Псевдо-3D</option>
            </select>
          </div>
        </div>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="showDebugGrid"
            checked={config.visual?.showDebugGrid === true}
            onChange={(e) => handleShowDebugChange(e.target.checked)}
          />
          <label htmlFor="showDebugGrid">Показывать сетку отладки (debug grid)</label>
        </div>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="effectsEnabled"
            checked={config.visual?.effectsEnabled !== false}
            onChange={(e) => handleVisualBoolChange("effectsEnabled", e.target.checked)}
          />
          <label htmlFor="effectsEnabled">Анимации и эффекты (левитация, частицы, bounce)</label>
        </div>
        <div className={`${styles.field} ${styles.checkboxField}`}>
          <input
            type="checkbox"
            id="soundEnabled"
            checked={config.visual?.soundEnabled !== false}
            onChange={(e) => handleVisualBoolChange("soundEnabled", e.target.checked)}
          />
          <label htmlFor="soundEnabled">Звуки (Howler)</label>
        </div>
      </div>

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

      {/* JSON RAW TEXTAREA */}
      <div className={`${styles.section} ${styles.jsonBlock}`}>
        <div className={styles.jsonHeader}>
          <span>JSON Конфигурация уровня</span>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`} 
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", height: "auto" }}
            onClick={onCopyJson}
          >
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
        <button 
          className={`${styles.btn} ${styles.btnSecondary}`} 
          style={{ width: "100%" }}
          onClick={() => onImportJson(jsonText)}
        >
          Импортировать JSON
        </button>
      </div>
    </div>
  );
}
