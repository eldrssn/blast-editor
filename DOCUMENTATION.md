# Block Blast Core + Редактор уровней — Документация проекта

> Справочник по **фактической** реализации (не по промптам). Цель — быстро находить нужный код без повторного чтения файлов.
> Связанные документы: [block_blast_core_game_prompts.md](block_blast_core_game_prompts.md) и [AGENTS.md](AGENTS.md) — это исходные ТЗ/промпты. Этот файл описывает то, что **уже сделано в коде**, и помечает расхождения с ТЗ.

---

## 1. Обзор

Core-игра в стиле Block Blast + редактор уровней с live preview. Одна страница — `/editor`. Корень `/` редиректит на `/editor` ([src/app/page.tsx](src/app/page.tsx)).

**Стек (фактический, [package.json](package.json)):**
- Next.js `16.2.9` (App Router) — в ТЗ заявлен 15+, по факту 16.
- React `19.2.4`, TypeScript `5`
- Pixi.js `^8.19.0` — рендеринг игры
- Zustand `^5.0.14` — стейт игры
- Sass (SCSS modules) — стили
- Howler `^2.2.4` — звук (заглушка под реальные аудио-файлы; пока ассетов нет — не играет, см. §9)

**Команды:** `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

---

## 2. Структура каталогов (FSD-подобная)

```txt
src/
  app/
    page.tsx              # redirect → /editor
    editor/page.tsx       # страница редактора (metadata + <LevelEditor/>)
    layout.tsx, globals.css

  entities/game/          # чистая логика, без React/Pixi
    config/
      figureShapes.ts     # FIGURE_SHAPES (15 фигур) + DEFAULT_FIGURE_WEIGHTS
      defaultLevels.ts    # DEFAULT_LEVELS (3 уровня) + defaultColors
    model/
      types.ts            # все типы домена
      validation.ts       # validateLevelConfig → string[] (ошибки на русском)
      normalize.ts        # normalizeLevelConfig → полный LevelConfig с дефолтами
    lib/
      board.ts            # createEmptyBoard, canPlaceFigure, placeFigure,
                          # findCompletedLines, clearCompletedLines, canPlaceAnyFigure
      figures.ts          # generateFigureSet (взвешенный спавн + retry на размещаемость)
      scoring.ts          # calculateScore, checkWinCondition, checkLoseCondition
      boosters.ts         # applyCollectAll, applyHammer
      gameFlow.ts         # resolvePostMove (win/regenerate/lose/protection)

  widgets/
    game-core/
      ui/GameCore.tsx     # React-обёртка: store↔Pixi, бустер-бар, оверлеи
      model/gameStore.ts  # Zustand-стор + экшены
      pixi/
        GameApplication.ts  # Application, resize, letterbox, прокси-методы
        GameScene.ts        # оркестратор слоёв + вся placement/booster-логика
        BackgroundLayer.ts  # деревянный фон по visual.backgroundId
        BoardLayer.ts       # сетка, кубы, подсветка placement, рамка молотка
        FigureLayer.ts      # слоты, левитация, drag-and-drop, bounce/return
        EffectsLayer.ts     # частицы воды, pop-анимации, combo-лейбл
        HudLayer.ts         # прогресс-бар воды, счёт, x2-индикатор
        HammerController.ts # ввод режима молотка (выбор области 4×4)
        cube.ts             # drawPseudo3DCube — псевдо-3D куб
        cubeContext.ts      # getCubeContext — кэш GraphicsContext по цвету+размеру
      styles/GameCore.module.scss
    # (sound) shared/lib/sound.ts — заглушка soundManager под будущие аудио-файлы
    level-editor/
      ui/
        LevelEditor.tsx     # layout: editorPane + previewPane + toast
        EditorForm.tsx      # композиция секций + кнопки Применить/Сбросить/Копир/Импорт
        sections/           # 8 секций формы (см. §7)
      model/useLevelEditor.ts  # вся логика редактора (edit/applied config, JSON, toast)
      styles/*.module.scss

  shared/lib/sound.ts       # soundManager (singleton, синтез WAV → Howler)
```

---

## 3. Модель данных ([types.ts](src/entities/game/model/types.ts))

### LevelConfig
```ts
type LevelConfig = {
  levelId: string;
  grid: { rows: number; cols: number };
  targetScore: number;
  initialBoard: Array<Array<BoardCellConfig | null>>;  // null = пустая клетка
  figures: {
    availableShapeIds: string[];
    spawnWeights: Record<string, number>;
    colors: string[];
  };
  boosters: {
    collectAll: { enabled: boolean; initialCount: number };
    multiplier: { enabled: boolean; initialCount: number; multiplierValue: number; duration: "until_level_end" };
    hammer:     { enabled: boolean; initialCount: number; areaRows: number; areaCols: number };
  };
  protectionFromLoss: { enabled: boolean; clearBoardCost: number };
  visual: {
    backgroundId: string;   // фон фиксирован (в редакторе не меняется), берётся из дефолтов
    cubeStyle: "pseudo3d";  // единственный стиль (в редакторе не меняется)
    showDebugGrid: boolean; // отладочная сетка поверх поля (рабочий тумблер)
  };
};
```

### Прочие типы
- `BoardCell` = `{ id; filled; color?; figureId? }` — `id` в формате `"r-c"`. Поле «вода» убрано — все кубики считаются «с водой» (капли при очистке летят на каждую клетку).
- `BoardCellConfig` = `{ filled; color? }` — для `initialBoard`.
- `FigureShape` = `{ id; cells: {row,col}[] }`; `FigureInstance` = `{ uid; shapeId; cells; color; placed }`.
- `GameStatus` = `idle | playing | dragging | booster_selecting | protection_from_loss | won | lost`.
- `GameState` — `config` может быть `null` до `initGame`.
- `CompletedLine` = `{ type: "row"|"col"; index }`; `ClearedCellCoord`, `ClearResult`, `CalculateScoreParams`, `HammerArea` (bounding box `startRow/startCol/endRow/endCol`).
- `BoosterType` = `"collectAll" | "multiplier" | "hammer"`.

> 📌 API-примечания (это и есть единая правда; ТЗ приведено в соответствие): `canPlaceFigure`/`placeFigure` принимают **`(board, figure, row, col)`**, а не `GridPosition`. `checkWinCondition(score, target)`; бустеры — `applyCollectAll(board)` / `applyHammer(board, area)`. Чистые функции — в `entities/game/lib`; **мутации состояния** — в Zustand-сторе ([gameStore.ts](src/widgets/game-core/model/gameStore.ts)) и в [GameScene.ts](src/widgets/game-core/pixi/GameScene.ts).

---

## 4. Игровая логика (`entities/game/lib`, чистые функции)

| Функция | Файл | Назначение |
|---|---|---|
| `createEmptyBoard(rows, cols, initialBoard?)` | board.ts | Строит `BoardCell[][]`, переносит pre-filled клетки из конфига. |
| `canPlaceFigure(board, figure, row, col)` | board.ts | Проверка границ + занятости. `row/col` — якорь (offset). |
| `placeFigure(board, figure, row, col)` | board.ts | Иммутабельно ставит фигуру, проставляет `color`/`figureId`. |
| `findCompletedLines(board)` | board.ts | Полные строки и столбцы. |
| `clearCompletedLines(board, lines)` | board.ts | Очистка через `Set` уникальных клеток → `ClearResult` (`clearedCellsCount` уникален на пересечениях). |
| `canPlaceAnyFigure(board, figures)` | board.ts | Можно ли поставить хоть одну неразмещённую. Если все размещены → `true`. |
| `generateFigureSet(config, board?)` | figures.ts | Взвешенный спавн 3 фигур. С `board` — до `PLACEABLE_RETRIES=12` попыток, чтобы набор был размещаем. |
| `calculateScore({clearedCellsCount, clearedLinesCount, isMultiplierActive, multiplierValue?})` | scoring.ts | `lines>0`: `cells*lines*mult`; иначе (бустеры): `cells*mult`. `mult = isActive ? multiplierValue(деф.2) : 1`. |
| `checkWinCondition(score, targetScore)` | scoring.ts | `score >= targetScore`. |
| `checkLoseCondition(board, figures)` | scoring.ts | `!canPlaceAnyFigure`. |
| `applyCollectAll(board)` | boosters.ts | Чистит все заполненные клетки. |
| `applyHammer(board, area)` | boosters.ts | Чистит заполненные внутри bounding box. |
| `resolvePostMove(board, figures, score, config)` | gameFlow.ts | Порядок: **1)** win → **2)** regenerate (если все placed) → **3)** `protection`/`lost` если некуда ставить → **4)** `playing`. Возвращает `{outcome, figures, regenerated}`. |

**Очки начисляются только** за очистку линий и бустеры (никогда за простую установку). Вода = очки.

---

## 5. Стор игры ([gameStore.ts](src/widgets/game-core/model/gameStore.ts))

Zustand. `GameStoreState = GameState & экшены`.

Экшены: `initGame(config)` (создаёт борд+набор, сбрасывает счёт/множитель/инвентарь), `setStatus/setBoard/setCurrentFigures/setScore/setActiveBooster`, `useBooster(type)` (списывает заряд если >0), `activateMultiplier()` (идемпотентен: no-op если не playing / уже активен / нет зарядов), `clearBoardAndContinue()` (защита от поражения: полностью чистит борд, при необходимости генерит новый набор, списывает `clearBoardCost` из счёта, **очки за защитную очистку не начисляются**).

---

## 6. Pixi-слой (`widgets/game-core`)

**Логическое разрешение сцены фиксировано: `SCENE_W=450 × SCENE_H=800` ([GameScene.ts](src/widgets/game-core/pixi/GameScene.ts)).** `HUD_HEIGHT=72`.

### Поток данных
```
React (GameCore) ──props/store──▶ GameApplication ──▶ GameScene ──▶ слои
        ▲                                                  │
        └────────── GameSceneCallbacks (board/figures/score/status/hammer) ──┘
```

- **GameApplication** — владеет `Application`, монтирует canvas, `ResizeObserver` с rAF-коалесингом, letterbox-масштаб сцены (`scale = min(scaleX, scaleY)`), DPR cap = 2, `antialias` всегда включён. Прокси-методы: `collectAll/enterHammerMode/exitHammerMode/setTickerActive/applyVisualConfig/updateState`.
- **GameScene** — оркестратор. Держит `board/figures/score/isMultiplierActive/multiplierValue`. Здесь вся **placement-логика** (`handlePlacementAttempt` → `handlePlacementSuccess` → `awardAndAnimateClear` → `afterClear`/`resolvePostMove`) и **исполнение бустеров** (`collectAll`, `applyHammerAt`). Единый `Ticker` гоняет левитацию + анимацию HUD + рамку молотка; `setTickerActive(false)` останавливает его на оверлеях.
  - `applyVisualConfig(config)` — горячее применение **косметики** (фон, лейбл уровня, targetScore, multiplierValue, `showDebugGrid`) без перестройки сцены.
- **BoardLayer** — сетка, пул кубов (`acquireCube`), `showHighlight` (зелёный/красный placement), `showHammerArea`+`tickHammer` (пульсация рамки), `getGridInfo()` (cellSize/offset — единый источник координат), `setShowDebugGrid(bool)`/`renderDebugGrid` (отладочная сетка границ клеток поверх поля).
- **FigureLayer** — слоты внизу, `updateLevitation`, drag-and-drop (`onFigurePointerDown/onPointerMove/onPointerUp`), `getGridPositionFromPointer`, `playBounceAnimation`, `animateReturnToSlot`. Колбэки в сцену: `getGridInfo/canPlaceAt/onHighlightUpdate/onPlacementAttempt/onPlacementSuccess`. `FigureLayer.slotHeight` — статик.
- **EffectsLayer** — `playLineClear` (pop-кубы + капли воды `spawnDroplet`/`spawnSplash` летят в HUD + combo-лейбл `showCombo` при ≥2 линий). Свой tween-loop, пул графики. Эффекты всегда включены (тумблера нет).
- **HudLayer** — прогресс-бар воды + счёт `0/target`, лейбл уровня (`formatLevelLabel(levelId)` → «Уровень N», число берётся из `levelId`), `tick` (плавный счётчик), `pulse`, `snapScore`, `getWaterTargetPoint()` (цель для капель), x2-индикатор при активном множителе.
- **HammerController** — только ввод режима молотка: `enter/cancel`, отслеживание области под указателем, размер из `config.boosters.hammer.areaRows/Cols`, `onConfirm(area)` → `GameScene.applyHammerAt`.
- **cube.ts / cubeContext.ts** — `drawPseudo3DCube` (основной цвет, тёмная нижняя грань, highlight, тень, скругление `CORNER_RADIUS=5`, `DEPTH=5`); `getCubeContext` кэширует `GraphicsContext` по `цвет+размер`.

### Бустеры — логика consume
- **collectAll**: `GameScene.collectAll()` возвращает `false` если борд пуст или активен молоток → заряд **не** тратится. React списывает заряд только при `true`.
- **multiplier**: активируется через стор (`activateMultiplier`), действует до конца уровня, `x2`-индикатор в HUD.
- **hammer**: вход в `booster_selecting`; `onHammerComplete(consumed)` — заряд тратится только если реально удалены клетки (подтверждение над пустой областью → `false`).

---

## 7. Редактор уровней (`widgets/level-editor`)

- **LevelEditor.tsx** — layout: левая `editorPane` (`<EditorForm/>`) + правая `previewPane` (`<GameCore config={appliedConfig}/>`) + inline-toast.
- **useLevelEditor.ts** — вся логика. Разделяет **`editConfig`** (то, что редактируется) и **`appliedConfig`** (то, что играется в preview). Превью обновляется только после **«Применить»**. `validationErrors` выводятся через `useMemo` из `editConfig`. JSON-зеркало (`jsonText`) синхронизируется; ручной ввод JSON парсится «на лету» (сохраняет сырой текст, при ошибке — `jsonError`). Toast вместо `alert`.
  - Хэндлеры: `handleTemplateChange` (выбор из `DEFAULT_LEVELS` или `"custom"`), `handleConfigChange`, `handleApply`, `handleReset`, `handleCopyJson` (clipboard), `handleImportJson`, `handleJsonChange`.
- **EditorForm.tsx** — композиция 8 секций (`sections/`):
  `TemplateSection` (выбор шаблона по `levelId`) · `MainParamsSection` (levelId/targetScore/grid — без названия уровня) · `InitialBoardSection` (интерактивная сетка: клик включает/выключает блок + цвет; кисти воды нет — все блоки «с водой») · `FiguresSection` (availableShapeIds + spawnWeights, каждая фигура показана мини-превью через [FigurePreview.tsx](src/widgets/level-editor/ui/FigurePreview.tsx)) · `BoostersSection` (enabled/count/multiplierValue/hammer area) · `ProtectionSection` (enabled + clearBoardCost) · `VisualSection` (только `showDebugGrid`; фон и стиль кубиков всегда фиксированы) · `JsonSection` (textarea + ошибки + Импорт).
- **[FigurePreview.tsx](src/widgets/level-editor/ui/FigurePreview.tsx)** — чистый React/CSS-grid компонент: по `shapeId` берёт геометрию из `FIGURE_SHAPES` и рисует мини-фигуру (без Pixi). Используется в `FiguresSection` в списке выбора и рядом с весами.

### GameCore ↔ редактор: ключевая оптимизация
[GameCore.tsx](src/widgets/game-core/ui/GameCore.tsx) различает **структурные** и **косметические** изменения конфига:
- **`structuralKey`** (`useMemo`) = grid, targetScore, initialBoard, figures, protectionFromLoss, booster counts/enabled → при изменении **полная перестройка Pixi + рестарт уровня**.
- **косметика** (levelId/лейбл уровня, `visual.showDebugGrid`, multiplierValue) → `applyVisualConfig` **горячо**, без сброса прогресса.

Оверлеи в GameCore: **победа** (status `won`), **поражение** (`lost`), **защита от поражения** (`protection_from_loss` — «Короб заполнен»/«Нет доступных ходов», кнопка очистки с учётом `clearBoardCost` и проверкой `canAffordClear`).

---

## 8. Конфиги и контент

- **[figureShapes.ts](src/entities/game/config/figureShapes.ts)** — `FIGURE_SHAPES` (15 фигур, id `"1"`…`"15"`) + `DEFAULT_FIGURE_WEIGHTS` (веса спавна; `"1"`=16 … `"15"`=1).
- **[defaultLevels.ts](src/entities/game/config/defaultLevels.ts)** — 3 уровня (без поля `title`):
  - `level_1` — target 60, простые фигуры, фон `wood_classic`.
  - `level_2` — target 120, pre-filled клетки по краям, фон `wood_dark`.
  - `level_3` — target 200, блок 2×2 в центре, все 15 фигур, фон `wood_royal`.
  - `defaultColors`: Rose `#FF708A`, Emerald `#3CD070`, Cobalt `#3C70FF`, Amber `#F59E0B`, Purple `#B070FF`.

---

## 9. Звук ([sound.ts](src/shared/lib/sound.ts))

**Заглушка под реальные аудио-файлы.** Процедурный WAV-синтез убран; звук появится как настоящие ассеты позже. Сейчас `soundManager.play()` — **no-op** (ничего не слышно). Имена событий: `pick | place | invalid | lineClear | booster | win | lose` — вызовы расставлены по коду (FigureLayer, GameScene, GameCore) и сохранятся.

Тумблера в конфиге **нет**: включать ли звук вообще — решает внешнее приложение-хост, а не `LevelConfig`.

**Чтобы включить звук:** положить файлы в `public/sounds/` и заполнить `SOUND_FILES` в [sound.ts](src/shared/lib/sound.ts), напр. `pick: ["/sounds/pick.webm", "/sounds/pick.mp3"]`. Пустая запись = безопасный no-op. Howler уже подключён и грузит Howl лениво по первому `play`.

---

## 10. Где что менять (шпаргалка)

| Задача | Файл(ы) |
|---|---|
| Новая фигура / веса | `entities/game/config/figureShapes.ts` |
| Новый шаблон уровня | `entities/game/config/defaultLevels.ts` |
| Правила очков / комбо | `entities/game/lib/scoring.ts` |
| Размещение / очистка линий | `entities/game/lib/board.ts` |
| Win/lose/regenerate/protection | `entities/game/lib/gameFlow.ts` + `gameStore.ts` |
| Поведение бустера (логика) | `entities/game/lib/boosters.ts` + `GameScene.ts` |
| Бустер-UI / оверлеи | `GameCore.tsx` |
| Внешний вид куба | `pixi/cube.ts`, `pixi/cubeContext.ts` |
| Фон | `pixi/BackgroundLayer.ts` (`visual.backgroundId`) |
| Анимации очистки/воды | `pixi/EffectsLayer.ts` |
| HUD / прогресс-бар | `pixi/HudLayer.ts` |
| Drag-and-drop | `pixi/FigureLayer.ts` |
| Молоток (выбор области) | `pixi/HammerController.ts` + `BoardLayer.showHammerArea` |
| Поля формы редактора | `widgets/level-editor/ui/sections/*` |
| Мини-превью фигур в редакторе | `widgets/level-editor/ui/FigurePreview.tsx` |
| Лейбл уровня в игре («Уровень N») | `pixi/HudLayer.ts` (`formatLevelLabel`) |
| Отладочная сетка поля | `pixi/BoardLayer.ts` (`setShowDebugGrid`) + `GameScene.renderState` |
| Валидация конфига | `entities/game/model/validation.ts` |
| Дефолты конфига | `entities/game/model/normalize.ts` |
| Структурный vs косметический ребилд | `GameCore.tsx` (`structuralKey`) + `GameScene.applyVisualConfig` |

---

## 11. Соответствие ТЗ

**Расхождения с исходным ТЗ (намеренные, код — единая правда).** 2026-06-15 ТЗ ([block_blast_core_game_prompts.md](block_blast_core_game_prompts.md) и ТЗ-секция [AGENTS.md](AGENTS.md)) были приведены в соответствие с кодом. Затем по правкам заказчика добавлены отклонения:

1. **Поле `title` удалено** из `LevelConfig`. Редактор оперирует только `levelId`; в игре HUD показывает «Уровень N», где N извлекается из `levelId` (`formatLevelLabel`).
2. **Поле `hasWater` удалено** из `BoardCell`/`BoardCellConfig`/`ClearedCellCoord`. Все кубики считаются «с водой»: капли/очки при очистке формируются для каждой клетки независимо от флага. Кисть «Блок с водой» из редактора убрана.
3. **Редактор визуала урезан:** выбор `backgroundId` и `cubeStyle` убран из UI (значения фиксированы, остаются дефолтами в `normalize`). Тумблер `showDebugGrid` теперь **реально работает** — рисует отладочную сетку в `BoardLayer`.
4. **Фигуры в редакторе** показываются мини-превью (`FigurePreview`) вместо «#id».

Что было унифицировано в ту сессию (для истории):
1. Next.js зафиксирован как **16** (был «15+» в ТЗ).
2. Сигнатуры функций в ТЗ переписаны под код (`row,col` вместо `GridPosition`; `applyCollectAll`/`applyHammer`; `checkWinCondition(score, target)`).
3. Поля `visual.effectsEnabled` / `visual.soundEnabled` **удалены** из кода: эффекты всегда включены, звук управляется хостом (см. §9). Конфиг снова совпадает с ТЗ.
4. Распределение логики (чистые функции в `lib`, мутации в `gameStore`/`GameScene`) описано в ТЗ.
5. Звук — заглушка под реальные файлы (синтез убран, см. §9).
6. Разделение структурных/косметических изменений конфига описано в ТЗ (§7).
7. Декомпозиция формы редактора на 8 секций описана в ТЗ (§7).

> При любой будущей правке, создающей отклонение кода от ТЗ, — синхронно правь и ТЗ, и этот раздел (см. правило в [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md)).
</content>
</invoke>
