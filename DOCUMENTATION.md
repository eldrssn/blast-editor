# Block Blast Core + Редактор уровней — Документация проекта

> Справочник по **фактической** реализации (не по промптам). Цель — быстро находить нужный код без повторного чтения файлов.
> Связанные документы: [block_blast_core_game_prompts.md](block_blast_core_game_prompts.md) и [AGENTS.md](AGENTS.md) — это исходные ТЗ/промпты. Этот файл описывает то, что **уже сделано в коде**, и помечает расхождения с ТЗ.

---

## 1. Обзор

Core-игра в стиле Block Blast + редактор уровней с live preview. Главная `/` запускает игру со **случайным уровнем** и открывает настройки уровня в одном экране; `/editor` остаётся полноценной desktop-страницей редактора ([src/app/page.tsx](src/app/page.tsx), [src/app/editor/page.tsx](src/app/editor/page.tsx)).

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
    page.tsx              # главная: игра со случайным уровнем + настройки уровня
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
        BackgroundLayer.ts  # ровный светло-коричневый фон сцены
        BoardLayer.ts       # сетка, кубы, подсветка placement, рамка молотка
        FigureLayer.ts      # слоты, левитация, drag-and-drop, bounce/return
        EffectsLayer.ts     # частицы воды, pop-анимации, combo-лейбл
        HudLayer.ts         # прогресс-бар воды, счёт, x2-индикатор
        HammerController.ts # ввод режима молотка (выбор области 4×4)
    cube.ts             # только CORNER_RADIUS=5 (скругление клеток/подсветок)
      styles/GameCore.module.scss
    # (sound) shared/lib/sound.ts — заглушка soundManager под будущие аудио-файлы
    level-editor/
      ui/
        LevelEditor.tsx     # layout: editorPane + previewPane + toast
        EditorForm.tsx      # композиция секций + кнопки Применить/Сбросить/Копир/Импорт
        sections/           # 8 секций формы (см. §7)
      model/useLevelEditor.ts  # вся логика редактора (edit/applied config, JSON, toast)
      styles/*.module.scss
    home-game/
      ui/HomeGameScreen.tsx      # главная: GameCore + drawer/side-sheet настроек
      styles/HomeGameScreen.module.scss

  shared/lib/sound.ts       # soundManager (singleton, синтез WAV → Howler)
  shared/lib/gameColors.ts  # pure (без Pixi): CUBE_COLOR_IDS/GRID_BOX_IDS + типы, пути ассетов, normalize/validate-хелперы
  shared/lib/gameAssets.ts  # Pixi-загрузка текстур (getCubeTexture/getGridTexture/preload), реэкспорт gameColors
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
    colors: ("green"|"orange"|"purple"|"red"|"yellow")[];
    scriptedOpening?: ScriptedFigure[];  // опц. скрипт старта: до 9 фигур (3 набора по 3); пусто/нет → весь спавн случайный
  };
  boosters: {
    collectAll: { enabled: boolean; initialCount: number };
    multiplier: { enabled: boolean; initialCount: number; multiplierValue: number; duration: "until_level_end" };
    hammer:     { enabled: boolean; initialCount: number };  // зона действия фиксирована 4×4 (HAMMER_AREA_SIZE), не настраивается
  };
  protectionFromLoss: { enabled: boolean };  // тест-сборка: очистка поля бесплатна, стоимости нет
  visual: {
    backgroundId: string;   // фон фиксирован (в редакторе не меняется), берётся из дефолтов
    cubeStyle: "pseudo3d";  // legacy-поле совместимости; runtime использует sprite-ассеты из public/game
    showDebugGrid: boolean; // отладочная сетка поверх поля (рабочий тумблер)
  };
};
```

### Прочие типы
- `BoardCell` = `{ id; filled; color?; figureId? }` — `id` в формате `"r-c"`. `color` хранит **asset-id** (`green|orange|purple|red|yellow`), а не hex. Поле «вода» убрано — все кубики считаются «с водой» (капли при очистке летят на каждую клетку).
- `BoardCellConfig` = `{ filled; color? }` — для `initialBoard`; цвет тоже asset-id.
- `ScriptedFigure` = `{ shapeId? }` — один слот стартового скрипта. Нет `shapeId` (или индекс вышел за длину) → слот случайный. Цвет в скрипте не хранится (всегда случайный).
- `FigureShape` = `{ id; cells: {row,col}[] }`; `FigureInstance` = `{ uid; shapeId; cells; color; placed }`.
- `GameStatus` = `idle | playing | dragging | booster_selecting | protection_from_loss | won | lost`.
- `GameState` — `config` может быть `null` до `initGame`. Поле `scriptedSetIndex: number` — сколько стартовых наборов уже взято из `figures.scriptedOpening` (0 на старте, → 1 после первого набора).
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
| `generateFigureSet(config, board?, scriptedSetIndex?)` | figures.ts | Взвешенный спавн 3 фигур. С `board` — до `PLACEABLE_RETRIES=12` попыток, чтобы набор был размещаем. `scriptedSetIndex` пинит слоты из среза `config.figures.scriptedOpening[idx*3 .. +2]` (заданный `shapeId` фиксируется, остальные слоты — рандом; ретрай пере-роллит только не-пиннутые; полностью пиннутый набор ретрай пропускает). |
| `calculateScore({clearedCellsCount, clearedLinesCount, isMultiplierActive, multiplierValue?})` | scoring.ts | `lines>0`: `cells*lines*mult`; иначе (бустеры): `cells*mult`. `mult = isActive ? multiplierValue(деф.2) : 1`. |
| `checkWinCondition(score, targetScore)` | scoring.ts | `score >= targetScore`. |
| `checkLoseCondition(board, figures)` | scoring.ts | `!canPlaceAnyFigure`. |
| `applyCollectAll(board)` | boosters.ts | Чистит все заполненные клетки. |
| `applyHammer(board, area)` | boosters.ts | Чистит заполненные внутри bounding box. |
| `resolvePostMove(board, figures, score, config, scriptedSetIndex?)` | gameFlow.ts | Порядок: **1)** win → **2)** regenerate (если все placed) → **3)** `protection`/`lost` если некуда ставить → **4)** `playing`. При регенерации передаёт `scriptedSetIndex` в `generateFigureSet`. Возвращает `{outcome, figures, regenerated, nextScriptedSetIndex}` (индекс +1 при регенерации). |

**Очки начисляются только** за очистку линий и бустеры (никогда за простую установку). Вода = очки.

**Кламп очков:** начисление в `GameScene.awardAndAnimateClear` (`onScoreArrive`) ограничено `Math.min(score + points, targetScore)` — счёт никогда не превышает цель (нет «100/60»; победа показывает ровно `target/target`). `calculateScore` остаётся чистой и кламп не делает.

---

## 5. Стор игры ([gameStore.ts](src/widgets/game-core/model/gameStore.ts))

Zustand. `GameStoreState = GameState & экшены`.

Экшены: `initGame(config)` (создаёт борд+набор с `scriptedSetIndex=0`, выставляет `scriptedSetIndex=1`, сбрасывает счёт/множитель/инвентарь), `setStatus/setBoard/setCurrentFigures/setScore/setActiveBooster`, `setScriptedSetIndex(i)` (синхронизация курсора скрипта из Pixi-сцены обратно в стор), `useBooster(type)` (списывает заряд если >0), `activateMultiplier()` (идемпотентен: no-op если не playing / уже активен / нет зарядов), `clearBoardAndContinue()` (защита от поражения: полностью чистит борд, при необходимости генерит новый набор — тогда и `scriptedSetIndex` +1; **тест-сборка: очистка бесплатна — очки не списываются и не начисляются**). Сама анимация исчезновения кубиков проигрывается отдельно — см. `GameScene.playBoardClear` (§6), стор только опустошает борд по завершении.

---

## 6. Pixi-слой (`widgets/game-core`)

**Логическое разрешение сцены фиксировано: `SCENE_W=450 × SCENE_H=800` ([GameScene.ts](src/widgets/game-core/pixi/GameScene.ts)).** `HUD_HEIGHT=72`.

**Вертикальный порядок (сверху вниз): HUD → поле → фигуры → бустеры.** Внизу сцены зарезервирована полоса `FigureLayer.boosterBand` (=`BOOSTER_BAND=70`) под HTML-бар бустеров: слоты фигур подняты на `SLOT_HEIGHT + BOOSTER_BAND`, поле резервирует снизу `slotHeight + boosterBand + 8`, а `.boosterBar` в [GameCore.module.scss](src/widgets/game-core/styles/GameCore.module.scss) прибит к низу (`bottom`).

### Поток данных
```
React (GameCore) ──props/store──▶ GameApplication ──▶ GameScene ──▶ слои
        ▲                                                  │
        └──── GameSceneCallbacks (board/figures/score/status/hammer/scriptedSetIndex) ──┘
```

- **GameApplication** — владеет `Application`, монтирует canvas, `ResizeObserver` с rAF-коалесингом, letterbox-масштаб сцены (`scale = min(scaleX, scaleY)`), DPR cap = 2, `antialias` всегда включён. Прокси-методы: `collectAll/enterHammerMode/confirmHammerMode/exitHammerMode/setTickerActive/applyVisualConfig/updateState/setScriptedSetIndex`. `updateState(board, figures, score, isMultiplierActive?)` рисует борд/фигуры/HUD; курсор скрипта зеркалится **отдельным** лёгким `setScriptedSetIndex(i)` → `GameScene.setScriptedSetIndex` (намеренно не в `updateState`, чтобы синк только курсора — эхо после регенерации в сцене — не вызывал лишний `renderState`).
- **GameScene** — оркестратор. Держит `board/figures/score/isMultiplierActive/multiplierValue`. Держит также `scriptedSetIndex` — зеркало курсора скрипта; **единый источник правды — стор**, сцена в `afterClear` при регенерации считает `nextScriptedSetIndex` и шлёт его в стор через `onScriptedSetIndexUpdate`, а GameCore синкает значение обратно в зеркало (эхо безопасно: это только присвоение числа, без рендера). Здесь вся **placement-логика** (`handlePlacementAttempt` → `handlePlacementSuccess` → `awardAndAnimateClear` → `afterClear`/`resolvePostMove`) и **исполнение бустеров** (`collectAll`, `applyHammerAt`). `playBoardClear(onComplete)` — анимированная защитная очистка: собирает `filled`-клетки, опустошает борд визуально и проигрывает `EffectsLayer.playCellsVanish` (поп-кубы **без** воды/очков); фактический wipe+регенерацию делает стор в `onComplete` (проброшен из [GameApplication](src/widgets/game-core/pixi/GameApplication.ts) → [GameCore](src/widgets/game-core/ui/GameCore.tsx)). Единый `Ticker` гоняет левитацию + анимацию HUD + рамку молотка; `setTickerActive(false)` останавливает его на оверлеях.
  - `applyVisualConfig(config)` — горячее применение **косметики** (фон, лейбл уровня, targetScore, multiplierValue, `showDebugGrid`) без перестройки сцены.
- **BoardLayer** — поле целиком на sprite-ассетах из `public/game`: под всей сеткой сначала рисуется отдельная тёплая **board-base** подложка; её цвет сейчас взят из пользовательского swatch-референса и затем затемнён в `2x` (текущий тон ≈ `#180501`), чтобы подложка попадала в более глубокий почти-чёрный бордово-коричневый диапазон. Подложка лежит под socket-тайлами и кубами и автоматически проявляется в зазорах между клетками и в прозрачных углах спрайтов. Поверх неё под **каждой** клеткой рисуется socket-тайл — детерминированный микс `box-1/box-2/box-3` (`getStableGridBoxId`, чтобы рисунок не мигал между re-render), а для заполненных клеток поверх тайла кладётся cube-sprite из пула по `BoardCell.color`. Тайл под кубом обязателен: у куба глянцевые скруглённые (прозрачные) углы, иначе куб выглядел бы как замена клетки, а не блок на ней. Между тайлами и кубами — `shadowGraphics`: мягкая контактная тень под каждой заполненной клеткой, смещённая влево-вниз (`CUBE_SHADOW_DX/DY/ALPHA`), читается как свет сверху-справа; сам ассет куба не трогается. Поверх этого: `showHighlight`, `showHammerArea`+`tickHammer`, `getGridInfo()` и `setShowDebugGrid(bool)`/`renderDebugGrid`.
- **FigureLayer** — слоты внизу, `updateLevitation`, drag-and-drop (`onFigurePointerDown/onPointerMove/onPointerUp`), `getGridPositionFromPointer`, `playBounceAnimation`, `animateReturnToSlot`. Колбэки в сцену: `getGridInfo/canPlaceAt/onHighlightUpdate/onPlacementAttempt/onPlacementSuccess`. `FigureLayer.slotHeight` / `FigureLayer.boosterBand` — статик. Фигуры в слотах и drag-preview собираются из sprite-кубиков того же asset-id, что и поле (`createFigureVisual`), и под каждым кубиком — такая же направленная тень влево-вниз (свет сверху-справа), как на поле; масштабируется по размеру клетки, рисуется позади кубиков. Drag-preview больше **не** имеет отдельной «парящей» тени — использует ту же per-cube тень. **Идемпотентный `draw`:** через `renderedKeys[slot]` (uid фигуры) графика слота пересоздаётся только при смене фигуры — посторонние ре-рендеры (board/score за одну установку) больше не пересоздают неизменные фигуры и не сбрасывают их левитацию (был «прыжок» при установке). Перетаскивание сбрасывает ключ слота (`redrawSlotWithoutFigure`). **Возврат в слот:** `animateReturnToSlot(container, slotIndex, figure, onComplete)` пивотит drag-контейнер вокруг центра фигуры (с компенсацией позиции) и едет в центр слота — иначе при scale-down вокруг угла фигура «уезжала» в правый-нижний угол и только потом стягивалась в центр. **Спавн-анимация:** новые фигуры (новые `uid` — initGame/регенерация) появляются «попом» (scale 0→1 `easeOutBack` + fade) со stagger'ом `SPAWN_STAGGER_MS` между слотами; `seenUids` гарантирует, что возврат той же фигуры в слот после неудачного дропа не анимируется повторно (`playSpawnAnimation`).
- **EffectsLayer** — `playLineClear` (pop-кубы + капли воды `spawnDroplet`/`spawnSplash` летят в HUD + combo-лейбл `showCombo` при ≥2 линий) и `playCellsVanish` (те же pop-кубы **без** воды/очков — для защитной очистки поля). Pop-куб теперь тоже sprite по asset-id очищаемой клетки; вода/label по-прежнему procedural. Свой tween-loop, пул графики. Эффекты всегда включены (тумблера нет). **z-order:** слой включает `sortableChildren`, а combo-лейбл получает `zIndex=1000`, чтобы он был поверх pop-кубов/капель того же клира (раньше кубы добавлялись после лейбла и перекрывали его).
- **HudLayer** — прогресс-бар воды + счёт `0/target`, лейбл уровня (`formatLevelLabel(levelId)` → «Уровень N», число берётся из `levelId`), `tick` (плавный счётчик), `pulse`, `snapScore`, `getWaterTargetPoint()` (цель для капель), x2-индикатор при активном множителе.
- **HammerController** — только ввод режима молотка: `enter/confirm/cancel`, отслеживание области под указателем; размер зоны **всегда 4×4** (экспортируемая константа `HAMMER_AREA_SIZE`, на маленьких полях клампится к размеру поля) — больше не берётся из конфига. На тач-экранах `pointerup` больше не применяет бустер: область выбирается жестом, а применение вызывается отдельно через `confirm()` → `GameScene.applyHammerAt`.
- **cube.ts** — только `CORNER_RADIUS=5` (скругление клеток поля и подсветок). Процедурная отрисовка кубов (`drawPseudo3DCube`) и кэш `GraphicsContext` (`cubeContext.ts`) удалены — кубы и фон-плитки рисуются sprite'ами из текстур (`gameAssets.ts`). **Важно:** pop-куб в `EffectsLayer` задаёт размер через `width/height`, поэтому scale-tween умножает на базовый масштаб (`baseScale = cube.scale.x`), а не задаёт абсолютный — иначе спрайт раздулся бы до нативного размера текстуры (поворот при этом сохранён, увеличения нет).

### Бустеры — логика consume
- **collectAll**: `GameScene.collectAll()` возвращает `false` если борд пуст или активен молоток → заряд **не** тратится. React списывает заряд только при `true`.
- **multiplier**: активируется через стор (`activateMultiplier`), действует до конца уровня, `x2`-индикатор в HUD. Множитель **не блокирует** другие бустеры — collectAll/hammer работают и при активном множителе (их очки тоже множатся).
- **hammer**: вход в `booster_selecting`; игрок двигает рамку по полю и подтверждает действие отдельной кнопкой `Применить`; `onHammerComplete(consumed)` — заряд тратится только если реально удалены клетки (подтверждение над пустой областью → `false`).

**Подтверждение бустеров (защита от дурака):** клик по «Собрать всё»/«Множитель» в [GameCore.tsx](src/widgets/game-core/ui/GameCore.tsx) не применяет бустер сразу, а открывает оверлей (`pendingBooster` + переиспользование `.overlayCard`) с описанием действия и кнопками «Применить»/«Отмена». Молоток использует собственный inline-режим выбора: поверх игры показывается подсказка с кнопками `Применить`/`Отмена`, а отпускание пальца только завершает позиционирование рамки.

---

## 7. Редактор уровней (`widgets/level-editor`) и главная игра (`widgets/home-game`)

- **LevelEditor.tsx** — layout: левая `editorPane` (`<EditorForm/>`) + правая `previewPane` (`<GameCore config={appliedConfig}/>`) + inline-toast.
- **HomeGameScreen.tsx** — mobile-first домашний экран: один раз выбирает случайный стартовый уровень из `DEFAULT_LEVELS`, показывает `GameCore`, кнопку открытия настроек и drawer/side-sheet с тем же `EditorForm`. После успешного `Применить` панель закрывается, поэтому игру можно тестировать на телефоне в одном экране.
- **useLevelEditor.ts** — общая логика и для `/editor`, и для `/`. Разделяет **`editConfig`** (то, что редактируется) и **`appliedConfig`** (то, что играется в preview/на главной). Игра обновляется только после **«Применить»**; выбор шаблона и импорт JSON меняют только draft редактора. `validationErrors` выводятся через `useMemo` из `editConfig`. JSON-зеркало (`jsonText`) синхронизируется; ручной ввод JSON парсится «на лету» (сохраняет сырой текст, при ошибке — `jsonError`). Для `handleApply`/`handleReset` клонирование конфига идёт через локальный helper: сначала `globalThis.structuredClone`, а на старых WebView — JSON fallback (`LevelConfig` держится сериализуемым специально для этого). Toast вместо `alert`.
  - Хэндлеры: `handleTemplateChange` (выбор из `DEFAULT_LEVELS` или `"custom"`), `handleConfigChange`, `handleApply` (возвращает `boolean` успеха), `handleReset`, `handleCopyJson` (clipboard), `handleImportJson`, `handleJsonChange`.
- **EditorForm.tsx** — композиция 8 секций (`sections/`):
  `TemplateSection` (выбор шаблона по `levelId`) · `MainParamsSection` (levelId/targetScore/grid — без названия уровня) · `InitialBoardSection` (интерактивная сетка: клик включает/выключает блок + цвет; кисти воды нет — все блоки «с водой») · `FiguresSection` (availableShapeIds + spawnWeights, каждая фигура показана мини-превью через [FigurePreview.tsx](src/widgets/level-editor/ui/FigurePreview.tsx); доступные фигуры идут сеткой `4` в ряд, веса генерации — `2` в ряд; ниже — подблок **«Стартовые фигуры (скрипт)»**: селект «Заданных наборов: 0/1/2/3» → `figures.scriptedOpening` длиной `N*3`, по 3 слота на набор, в каждом селект `shapeId` («Случайно» + доступные фигуры с `FigurePreview`). Цвет всегда случайный. Снятие фигуры из доступных обнуляет её слоты в скрипте) · `BoostersSection` (enabled/count/multiplierValue; зона молотка показана как «4 × 4 (фиксировано)», не редактируется) · `ProtectionSection` (только тумблер enabled — поле стоимости очистки убрано) · `VisualSection` (только `showDebugGrid`; фон и стиль кубиков всегда фиксированы) · `JsonSection` (textarea + ошибки + Импорт).
- **[FigurePreview.tsx](src/widgets/level-editor/ui/FigurePreview.tsx)** — чистый React/CSS-grid компонент: по `shapeId` берёт геометрию из `FIGURE_SHAPES` и рисует мини-фигуру (без Pixi). Используется в `FiguresSection` в списке выбора и рядом с весами.

### GameCore ↔ редактор: ключевая оптимизация
[GameCore.tsx](src/widgets/game-core/ui/GameCore.tsx) различает **структурные** и **косметические** изменения конфига:
- **`structuralKey`** (`useMemo`) = grid, targetScore, initialBoard, figures, protectionFromLoss, booster counts/enabled → при изменении **полная перестройка Pixi + рестарт уровня**.
- **косметика** (levelId/лейбл уровня, `visual.showDebugGrid`, multiplierValue) → `applyVisualConfig` **горячо**, без сброса прогресса.

Оверлеи в GameCore: **победа** (status `won`), **поражение** (`lost`), **защита от поражения** (`protection_from_loss` — «Короб заполнен»/«Нет доступных ходов», выбор «Очистить поле и продолжить» (бесплатно, с анимацией исчезновения через `playBoardClear`) / «Завершить уровень» → экран `lost`; стоимости/`canAffordClear` больше нет), **подтверждение бустера** (`pendingBooster` для collectAll/multiplier — «Применить»/«Отмена», см. §6). Для молотка вместо модалки показывается inline-панель выбора с теми же действиями.

---

## 8. Конфиги и контент

- **[figureShapes.ts](src/entities/game/config/figureShapes.ts)** — `FIGURE_SHAPES` (15 фигур, id `"1"`…`"15"`) + `DEFAULT_FIGURE_WEIGHTS` (веса спавна; `"1"`=16 … `"15"`=1).
- **[defaultLevels.ts](src/entities/game/config/defaultLevels.ts)** — **15 уровней** (`level_1`…`level_15`, без поля `title`), все уровни используют поле **`8×8`**; кривая сложности строится через `targetScore`, число и крупность фигур, плотность препятствий; защита от поражения у всех включена и **бесплатна** (стоимость очистки убрана); инвентарь бустеров беднеет, фоны циклятся classic/dark/royal. Препятствия рисуются хелпером `paintBoard(rows, cols, set => …)` (out-of-bounds игнорируется). Цветовая палитра уровня теперь хранится как asset-id: `green`, `orange`, `purple`, `red`, `yellow`.
  - `level_1` target 60 (8×8) · `level_2` 120 · `level_3` 200 — исходное «ядро».
  - `level_4`–`level_8`: 90→200, чистое поле → углы/полоса/блоки 2×2 на `8×8`.
  - `level_9`–`level_12`: 240→360, только крупные фигуры / диагонали / рассыпка, но всё ещё на `8×8`.
  - `level_13`–`level_15`: 300→520, плотные паттерны препятствий и финальный упор на фигуру `15` с множителем ×3, тоже на `8×8`.
  - `defaultColors`: `green`, `orange`, `purple`, `red`, `yellow` (+ именованные константы `GREEN/ORANGE/PURPLE/RED/YELLOW`).

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
| Скрипт стартовых фигур (первые наборы) | `entities/game/lib/figures.ts` (`generateFigureSet` + `scriptedSetIndex`) + `gameFlow.ts` + `gameStore.ts` (`scriptedSetIndex`) + `GameScene.afterClear` + `FiguresSection.tsx` |
| Новый шаблон уровня | `entities/game/config/defaultLevels.ts` |
| Правила очков / комбо | `entities/game/lib/scoring.ts` |
| Размещение / очистка линий | `entities/game/lib/board.ts` |
| Win/lose/regenerate/protection | `entities/game/lib/gameFlow.ts` + `gameStore.ts` |
| Поведение бустера (логика) | `entities/game/lib/boosters.ts` + `GameScene.ts` |
| Бустер-UI / оверлеи / окно подтверждения | `GameCore.tsx` (`pendingBooster`, `isHammerSelecting`) |
| Порядок раскладки / полоса бустеров | `FigureLayer.boosterBand` + `GameScene.renderState` + `GameCore.module.scss` (`.boosterBar`) |
| Кламп очков по цели | `GameScene.awardAndAnimateClear` (`onScoreArrive`) |
| Палитра/ID цветов и плиток, normalize/validate-хелперы | `shared/lib/gameColors.ts` (pure) |
| Загрузка/preload текстур (Pixi) | `shared/lib/gameAssets.ts` |
| Внешний вид куба/сетки в runtime | `pixi/BoardLayer.ts`, `pixi/FigureLayer.ts`, `pixi/EffectsLayer.ts` |
| Фон | `pixi/BackgroundLayer.ts` (ровная светло-коричневая заливка) |
| Анимации очистки/воды | `pixi/EffectsLayer.ts` (`playLineClear`/`playCellsVanish`/`popCube`) |
| Анимированная защитная очистка поля | `GameScene.playBoardClear` + `GameApplication.playBoardClear` + `GameCore.handleProtectionClear` |
| Спавн-анимация фигур внизу | `pixi/FigureLayer.ts` (`playSpawnAnimation`, `seenUids`) |
| HUD / прогресс-бар | `pixi/HudLayer.ts` |
| Drag-and-drop | `pixi/FigureLayer.ts` |
| Молоток (выбор области) | `pixi/HammerController.ts` (`HAMMER_AREA_SIZE` = 4×4) + `BoardLayer.showHammerArea` |
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
3. **Редактор визуала урезан:** выбор `backgroundId` и `cubeStyle` убран из UI. `cubeStyle` остаётся legacy-полем в `normalize`, но runtime теперь использует фиксированные sprite-ассеты из `public/game`; `backgroundId` пока сохранён только в данных для совместимости и не влияет на рендер: `BackgroundLayer` рисует единый светло-коричневый фон. Тумблер `showDebugGrid` теперь **реально работает** — рисует отладочную сетку в `BoardLayer`.
4. **Фигуры в редакторе** показываются мини-превью (`FigurePreview`) вместо «#id».
5. **Кламп очков** по `targetScore` при начислении — счёт не может превысить цель (нет «100/60»).
6. **Левитация фигур** больше не «дёргается» при установке — `FigureLayer.draw` идемпотентен (`renderedKeys`).
7. **Все бустеры требуют явного подтверждения**: «Собрать всё» и «Множитель» — в модальном окне, молоток — отдельной кнопкой `Применить` в режиме выбора; множитель не блокирует другие бустеры.
8. **Порядок раскладки сцены** изменён на HUD → поле → фигуры → бустеры (бар бустеров перенесён вниз, зарезервирована полоса `BOOSTER_BAND`).
9. **Уровней стало 15** (было 3): добавлены `level_4`…`level_15` с прогрессией сложности (см. §8).
10. **Поле `clearBoardCost` удалено** из `protectionFromLoss` (тип, валидация, normalize, все 15 уровней, секция редактора). Тест-сборка: защитная очистка поля **бесплатна** — очки не списываются. Экран конца ходов даёт выбор «Очистить поле и продолжить» / «Завершить уровень» (→ существующий экран «Поражение»).
11. **Анимация защитной очистки поля**: при «Очистить поле» кубики исчезают поп-анимацией (`EffectsLayer.playCellsVanish` через `GameScene.playBoardClear`) — как при очистке линий, но **без** капель воды и начисления очков.
12. **Спавн-анимация фигур**: три фигуры внизу появляются «попом» со stagger'ом (`FigureLayer.playSpawnAnimation`, гейт по `seenUids`) при старте уровня и регенерации набора.
13. **Зона молотка зафиксирована 4×4** для всех уровней. Поля `areaRows/areaCols` удалены из `boosters.hammer` (тип, валидация, normalize, все 15 уровней, контролы редактора). Размер задаётся константой `HAMMER_AREA_SIZE` в [HammerController.ts](src/widgets/game-core/pixi/HammerController.ts) (на полях меньше 4 клампится к размеру поля).
14. **Скрипт стартовых фигур** (`figures.scriptedOpening?: ScriptedFigure[]`, новый тип `ScriptedFigure`): опционально жёстко задаёт фигуры первых наборов (до 3 наборов = 9 фигур). Слот без `shapeId` — случайный; цвет всегда случайный. Потребление отслеживается через `scriptedSetIndex` в `GameState` — **единый источник правды — стор** (initGame → 1; регенерация в `resolvePostMove`/`GameScene.afterClear` и в `clearBoardAndContinue` — +1). Курсор зеркалится в Pixi **отдельным** `GameApplication.setScriptedSetIndex(i)` (не через `updateState`, чтобы не дёргать `renderState`); сцена сообщает свой `nextScriptedSetIndex` обратно колбэком `onScriptedSetIndexUpdate`. `normalize` держит длину `scriptedOpening` кратной 3 (наборы целиком; набор из сплошь случайных слотов сохраняется, чтобы выбор «N наборов» переживал round-trip) и удаляет поле целиком, только если нигде нет ни одного `shapeId`. В редакторе — подблок «Стартовые фигуры (скрипт)» в `FiguresSection`. В ТЗ отсутствует.
15. **Добавлен fallback для `structuredClone`** в редакторном состоянии: `useLevelEditor` клонирует `LevelConfig` через `globalThis.structuredClone`, а на старых Android WebView откатывается к `JSON.parse(JSON.stringify(...))`. Для текущей формы данных это безопасно и закрывает риск запуска на устройствах без нативного `structuredClone`.
16. **Кубики и сетка переведены на реальные ассеты** из `public/game`: `BoardCell.color`/`figures.colors` теперь хранят asset-id (`green|orange|purple|red|yellow`), а не hex. Пустые клетки поля — стабильный детерминированный микс `box-1|box-2|box-3`; заполненные клетки, фигуры в слотах, drag-preview и pop-анимации очистки рендерятся через sprite-текстуры. `normalizeLevelConfig` сохраняет backward compatibility со старыми hex-конфигами, конвертируя их в новые id.

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
