import { LevelConfig } from "./types";
import { FIGURE_SHAPES } from "../config/figureShapes";

const KNOWN_SHAPE_IDS = new Set(FIGURE_SHAPES.map((s) => s.id));

export function validateLevelConfig(config: Partial<LevelConfig> | null | undefined): string[] {
  const errors: string[] = [];

  if (!config) {
    return ["Конфигурация не задана"];
  }

  // levelId
  if (typeof config.levelId !== "string" || config.levelId.trim() === "") {
    errors.push("ID уровня (levelId) должен быть непустой строкой.");
  }

  // grid
  if (!config.grid || typeof config.grid !== "object") {
    errors.push("Поле 'grid' должно быть объектом.");
  } else {
    const { rows, cols } = config.grid;
    if (typeof rows !== "number" || rows <= 0 || !Number.isInteger(rows)) {
      errors.push("Количество строк (grid.rows) должно быть целым положительным числом.");
    }
    if (typeof cols !== "number" || cols <= 0 || !Number.isInteger(cols)) {
      errors.push("Количество столбцов (grid.cols) должно быть целым положительным числом.");
    }
  }

  // targetScore
  if (typeof config.targetScore !== "number" || config.targetScore <= 0) {
    errors.push("Целевой счет (targetScore) должен быть положительным числом.");
  }

  // initialBoard
  if (!Array.isArray(config.initialBoard)) {
    errors.push("Стартовая сетка (initialBoard) должна быть двумерным массивом.");
  } else if (config.grid) {
    const rows = config.grid.rows;
    const cols = config.grid.cols;
    if (config.initialBoard.length !== rows) {
      errors.push(`Размер initialBoard по вертикали (${config.initialBoard.length}) не соответствует grid.rows (${rows}).`);
    } else {
      for (let r = 0; r < rows; r++) {
        const row = config.initialBoard[r];
        if (!Array.isArray(row)) {
          errors.push(`Строка initialBoard[${r}] должна быть массивом.`);
        } else if (row.length !== cols) {
          errors.push(`Длина строки initialBoard[${r}] (${row.length}) не соответствует grid.cols (${cols}).`);
        }
      }
    }
  }

  // figures
  if (!config.figures || typeof config.figures !== "object") {
    errors.push("Поле 'figures' должно быть объектом.");
  } else {
    const { availableShapeIds, spawnWeights, colors } = config.figures;
    if (!Array.isArray(availableShapeIds) || availableShapeIds.length === 0) {
      errors.push("Список доступных фигур (figures.availableShapeIds) должен быть непустым массивом.");
    } else {
      const unknownIds = availableShapeIds.filter((id) => !KNOWN_SHAPE_IDS.has(id));
      if (unknownIds.length > 0) {
        errors.push(`Неизвестные ID фигур в availableShapeIds: ${unknownIds.join(", ")}.`);
      }
    }
    if (!Array.isArray(colors) || colors.length === 0) {
      errors.push("Список цветов (figures.colors) должен быть непустым массивом.");
    }
    if (!spawnWeights || typeof spawnWeights !== "object") {
      errors.push("Поле весов спавна (figures.spawnWeights) должно быть объектом.");
    } else if (Array.isArray(availableShapeIds)) {
      availableShapeIds.forEach((id) => {
        if (typeof spawnWeights[id] !== "number" || spawnWeights[id] < 0) {
          errors.push(`Вес для фигуры '${id}' должен быть неотрицательным числом.`);
        }
      });
    }
  }

  // boosters
  if (!config.boosters || typeof config.boosters !== "object") {
    errors.push("Поле 'boosters' должно быть объектом.");
  } else {
    const { collectAll, multiplier, hammer } = config.boosters;
    if (!collectAll || typeof collectAll !== "object") {
      errors.push("Бустер 'collectAll' не настроен.");
    } else if (typeof collectAll.initialCount !== "number" || collectAll.initialCount < 0) {
      errors.push("Количество зарядов бустера collectAll должно быть неотрицательным числом.");
    }

    if (!multiplier || typeof multiplier !== "object") {
      errors.push("Бустер 'multiplier' не настроен.");
    } else {
      if (typeof multiplier.initialCount !== "number" || multiplier.initialCount < 0) {
        errors.push("Количество зарядов бустера multiplier должно быть неотрицательным числом.");
      }
      if (typeof multiplier.multiplierValue !== "number" || multiplier.multiplierValue <= 1) {
        errors.push("Значение множителя в бустере multiplier должно быть больше 1.");
      }
    }

    if (!hammer || typeof hammer !== "object") {
      errors.push("Бустер 'hammer' не настроен.");
    } else {
      if (typeof hammer.initialCount !== "number" || hammer.initialCount < 0) {
        errors.push("Количество зарядов бустера hammer должно быть неотрицательным числом.");
      }
      if (typeof hammer.areaRows !== "number" || hammer.areaRows <= 0) {
        errors.push("Высота зоны действия молотка (areaRows) должна быть положительным числом.");
      }
      if (typeof hammer.areaCols !== "number" || hammer.areaCols <= 0) {
        errors.push("Ширина зоны действия молотка (areaCols) должна быть положительным числом.");
      }
    }
  }

  // protectionFromLoss
  if (!config.protectionFromLoss || typeof config.protectionFromLoss !== "object") {
    errors.push("Поле 'protectionFromLoss' должно быть объектом.");
  } else {
    const { clearBoardCost } = config.protectionFromLoss;
    if (typeof clearBoardCost !== "number" || clearBoardCost < 0) {
      errors.push("Стоимость защиты от поражения (clearBoardCost) должна быть неотрицательным числом.");
    }
  }

  return errors;
}
