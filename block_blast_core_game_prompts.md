# Промпты для агента: создание core-игры Block Blast + редактор уровней

> ⚠️ **Это исходные промпты (история замысла). Единая правда о реализации — [DOCUMENTATION.md](DOCUMENTATION.md).**
> Документ выверен по коду на 2026-06-15: стек, сигнатуры функций, звук и архитектура ниже приведены в соответствие с фактом. При расхождении верь коду + DOCUMENTATION.md. Правила работы агента — [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md).
>
> Ключевые факты реализации (детали — в DOCUMENTATION.md):
> - **Эффекты** всегда включены (тумблера `visual.effectsEnabled` нет); поля `effectsEnabled`/`soundEnabled` в `visual` отсутствуют.
> - **Звук** — заглушка `soundManager` под реальные аудио-файлы (`public/sounds/`), пока не играет; включением управляет хост-приложение, а не конфиг.
> - **Логика** распределена: чистые функции в `entities/game/lib`, мутации состояния — в `gameStore.ts` (Zustand) и `GameScene.ts`.
> - **Конфиг preview** применяется через разделение **структурных** (полный ребилд + рестарт) и **косметических** (горячо, без сброса) изменений — см. `GameCore.tsx`.
> - **Форма редактора** разбита на 8 секций в `widgets/level-editor/ui/sections/`.

## 0. Общий контекст проекта

Нужно создать **core-игру в стиле Block Blast** для мобильного WebView.

Это не полный проект “Денежное дерево”. Не нужно реализовывать дерево, мешочки, магазин, задания, призы, кастомизацию и другие мета-механики. Нужна только самостоятельная core-игра:

- игровое поле;
- генерация фигур;
- drag-and-drop фигур;
- подсветка возможного размещения;
- очистка линий;
- начисление очков / воды;
- бустеры;
- победа / поражение;
- защита от поражения;
- редактор уровней;
- live preview игры в редакторе.

Игра должна быть сделана на **Next.js latest + React + TypeScript**.

Рекомендуемый стек:

```json
{
  "next": "16+",
  "react": "19+",
  "typescript": "5+",
  "pixi.js": "8+",
  "zustand": "5+",
  "sass": "1+",
  "howler": "2+"
}
```

> Фактически в проекте: Next.js `16.2.9`, React `19.2.4` (см. [package.json](package.json)).

Для самой игры использовать **Pixi.js**.  
Для редактора уровней использовать **React UI**.

Нужна одна страница:

```txt
/editor
```

На странице `/editor` должен быть редактор уровня и live preview игры.

---

# Важные правила для агента

## Что нужно делать

Сделать playable core-игру Block Blast-like:

- поле 8×8;
- 3 фигуры снизу;
- фигуры перетаскиваются на поле;
- фигуры нельзя вращать;
- линии очищаются по горизонтали и вертикали;
- очки / вода начисляются только при очистке линии или через бустеры;
- победа наступает при достижении targetScore;
- поражение наступает, если ни одну из 3 доступных фигур нельзя поставить;
- при поражении сначала показывается защита от поражения;
- сделать 3 бустера: “Собрать всё”, “Множитель”, “Молоток”;
- сделать редактор уровней на `/editor`;
- сделать JSON-конфиг уровня;
- сделать live preview игры в редакторе;
- сделать валидацию конфига.

## Что НЕ нужно делать

Не нужно реализовывать:

- дерево;
- мешочки;
- магазин;
- задания;
- Daily Streak;
- призы;
- промокоды;
- шаринг дерева;
- бизнес-интеграции;
- реальные API;
- авторизацию;
- реальные платежи М+;
- полноценный продакшен-flow приложения.

Если нужны внешние данные, использовать mock / local config.

---

# Описание core-игры

## Основная механика

Игра похожа на Block Blast: игрок получает 3 фигуры и размещает их на игровом поле 8×8.

Фигуры не падают сверху, как в классическом тетрисе. Игрок вручную перетаскивает фигуры из нижних слотов на поле.

Фигуры нельзя вращать.

После того как игрок поставил все 3 фигуры, генерируется новый набор из 3 фигур.

Если игрок не может поставить ни одну из доступных фигур, считается, что место закончилось. В этот момент нужно показать окно защиты от поражения.

---

## Поле

Поле:

```txt
8 x 8
```

Каждая клетка может быть в одном из состояний:

- пустая;
- занята кубиком;
- подсвечена как валидная зона placement;
- подсвечена как invalid placement;
- входит в линию, которая будет очищена;
- входит в зону действия молотка;
- находится в анимации исчезновения.

Координаты поля лучше хранить как:

```ts
type GridPosition = {
  row: number;
  col: number;
};
```

Состояние клетки:

```ts
type BoardCell = {
  id: string;
  filled: boolean;
  color?: string;
  figureId?: string;
  hasWater?: boolean;
};
```

---

## Фигуры

Фигура — это набор клеток относительно origin-точки.

Пример:

```ts
type FigureShape = {
  id: string;
  cells: Array<{
    row: number;
    col: number;
  }>;
};
```

Фигуры должны задаваться через конфиг.

Нужно добавить 15 базовых фигур:

```ts
const FIGURE_SHAPES = [
  {
    id: "1",
    cells: [{ row: 0, col: 0 }]
  },
  {
    id: "2",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 }
    ]
  },
  {
    id: "3",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 }
    ]
  },
  {
    id: "4",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 }
    ]
  },
  {
    id: "5",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 }
    ]
  },
  {
    id: "6",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "7",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "8",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 }
    ]
  },
  {
    id: "9",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 }
    ]
  },
  {
    id: "10",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "11",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 }
    ]
  },
  {
    id: "12",
    cells: [
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
      { row: 2, col: 1 }
    ]
  },
  {
    id: "13",
    cells: [
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 }
    ]
  },
  {
    id: "14",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  },
  {
    id: "15",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]
  }
];
```

Вероятности генерации:

```ts
const DEFAULT_FIGURE_WEIGHTS = {
  "1": 16,
  "2": 10,
  "3": 10,
  "4": 8,
  "5": 8,
  "6": 6,
  "7": 9,
  "8": 4,
  "9": 4,
  "10": 6,
  "11": 5,
  "12": 5,
  "13": 4,
  "14": 4,
  "15": 1
};
```

---

## Генерация фигур

Игрок всегда видит 3 фигуры.

Фигуры генерируются на основе `figureSpawnWeights`.

После установки всех 3 фигур нужно сгенерировать новый набор из 3.

Нужно предусмотреть, чтобы генератор был расширяемым:

```ts
function generateFigureSet(config: LevelConfig): FigureInstance[];
```

Фигура должна иметь:

```ts
type FigureInstance = {
  uid: string;
  shapeId: string;
  cells: FigureCell[];
  color: string;
  placed: boolean;
};
```

---

## Drag-and-drop

Поведение:

1. Фигура лежит в нижнем домашнем слоте.
2. В слоте она отображается чуть меньше, чем кубики на поле.
3. Фигура слегка левитирует.
4. При нажатии / touch start фигура увеличивается до оригинального размера.
5. При перемещении фигура следует за пальцем / курсором.
6. Когда фигура находится над полем, нужно определить ближайшую клетку.
7. Если фигуру можно поставить в это место, подсветить клетки поля.
8. Если поставить нельзя, показать invalid-state или не подсвечивать.
9. Если игрок отпустил фигуру в валидном месте, поставить её на поле.
10. После установки фигура немного bounce-анимируется.
11. Если игрок отпустил фигуру вне поля или в невалидном месте, фигура возвращается в домашний слот.

Важно:

- фигуры нельзя вращать;
- нельзя ставить фигуру поверх занятых клеток;
- нельзя ставить фигуру за границы поля;
- placement считается валидным только если все клетки фигуры помещаются в пустые клетки поля.

---

## Очки / вода

Вода и очки — это одно и то же.

На экране должен быть progress bar / counter:

```txt
💧 0/60
```

`targetScore` задаётся в конфиге уровня.

Очки начисляются только:

1. при очистке заполненной линии;
2. при использовании бустера.

Очки НЕ начисляются просто при установке фигуры на поле.

---

## Очистка линий

После установки фигуры нужно проверить:

- заполненные горизонтальные линии;
- заполненные вертикальные линии.

Если линия полностью заполнена, её нужно очистить.

Если одновременно заполнены несколько линий, нужно применить multiplier:

- 1 линия = x1;
- 2 линии = x2;
- 3 линии = x3;
- 4 линии = x4;
- и так далее.

Пример:

```ts
const baseScore = clearedCellsCount;
const lineMultiplier = clearedLinesCount;
const boosterMultiplier = isMultiplierActive ? 2 : 1;
const totalScore = baseScore * lineMultiplier * boosterMultiplier;
```

Если одна и та же клетка входит и в горизонтальную, и в вертикальную линию, её нельзя считать два раза как отдельный очищенный кубик. Для расчёта baseScore нужно использовать уникальные клетки.

---

## Победа

Победа наступает, когда:

```ts
score >= targetScore
```

После победы:

- остановить interaction;
- показать victory modal / overlay;
- показать набранные очки;
- добавить кнопку “Перезапустить уровень”;
- добавить кнопку “Сбросить preview” или “Играть заново”.

---

## Поражение

После каждого хода нужно проверить, можно ли поставить хотя бы одну из доступных неразмещённых фигур.

Если ни одну фигуру нельзя поставить:

1. показать окно “Защита от поражения”;
2. предложить очистить поле;
3. если игрок подтверждает — поле очищается, игра продолжается;
4. если игрок отказывается — уровень считается проигранным.

Важно:

- поражение не должно наступать, если хотя бы одну фигуру можно поставить;
- если все 3 фигуры уже размещены, сначала нужно сгенерировать новый набор, а потом проверить возможность хода.

---

# Бустеры

В игре нет блокеров. Есть только бустеры.

## 1. Бустер “Собрать всё”

Поведение:

- очищает все занятые клетки на поле;
- со всех очищенных кубиков начисляются очки / вода;
- проигрывается анимация полёта воды в progress bar;
- после применения поле становится пустым;
- бустер тратится после успешного использования.

Формула:

```ts
const baseScore = filledCellsCount;
const boosterMultiplier = isMultiplierActive ? 2 : 1;
const totalScore = baseScore * boosterMultiplier;
```

---

## 2. Бустер “Множитель”

Поведение:

- действует до конца уровня;
- все получаемые очки / вода умножаются на 2;
- под progress bar появляется иконка `x2`;
- progress bar переходит в активное состояние;
- визуально можно добавить glow / fire / pulse эффект.

Важно:

- если игрок активировал множитель, он остаётся активным до победы или поражения;
- если игрок перезапустил уровень, множитель сбрасывается;
- если множитель уже активен, повторная активация не должна ломать состояние.

---

## 3. Бустер “Молоток”

Поведение:

- при выборе бустера игра переходит в режим выбора области;
- область выбора — 4×4 клетки;
- игрок может перемещать область по полю;
- все занятые клетки внутри области подсвечиваются как будущие удаляемые;
- область можно выбрать в любом месте поля;
- после подтверждения / release выбранные кубы исчезают;
- со всех удалённых кубов начисляются очки / вода;
- проигрывается анимация исчезновения и полёта воды;
- бустер тратится только после успешного применения;
- если игрок отменил действие, бустер не тратится.

Формула:

```ts
const removedCellsCount = countFilledCellsInHammerArea();
const boosterMultiplier = isMultiplierActive ? 2 : 1;
const totalScore = removedCellsCount * boosterMultiplier;
```

---

# Визуал и эффекты

## Общий вид

Игра должна быть vertical mobile-first.

Формат preview:

```txt
9:16
```

Визуально ориентироваться на предоставленный концепт:

- деревянный фон;
- поле 8×8 поверх фона;
- сверху progress bar с водой;
- кнопки управления сверху;
- снизу 3 фигуры;
- фигуры и кубики с псевдо-3D эффектом.

---

## Кубики

Кубики должны быть не плоскими.

Сделать псевдо-3D:

- основной цвет;
- тёмная нижняя грань;
- небольшой highlight;
- тень;
- лёгкое смещение граней;
- округлённые углы.

Можно реализовать через Pixi Graphics или через спрайты.

Если ассетов нет, использовать procedural drawing через Pixi Graphics.

---

## Фигуры в слотах

Фигуры в нижних слотах:

- меньше, чем на игровом поле;
- левитируют;
- имеют лёгкую idle-анимацию;
- находятся внутри “домашних” контейнеров / slot frames.

При выборе:

- фигура увеличивается до размера клеток поля;
- становится поверх остальных слоёв;
- следует за пальцем.

Если placement невалидный:

- фигура возвращается в слот с плавной анимацией.

---

## Подсветка placement

Когда игрок тащит фигуру над полем:

- если фигура помещается — подсветить клетки, куда она встанет;
- если не помещается — либо не подсвечивать, либо подсветить красным / invalid;
- подсветка должна обновляться в real-time при перемещении.

---

## Установка фигуры

После успешного placement:

- кубики появляются на поле;
- фигура делает небольшой bounce;
- затем проверяются линии;
- если линии собраны, они подсвечиваются и исчезают.

---

## Очистка линий

При очистке линии:

- линия подсвечивается;
- кубики делают scale / fade / pop-анимацию;
- после исчезновения клетки становятся пустыми;
- вода / очки летят в progress bar.

---

## Анимация воды

При начислении очков:

- от очищенных кубиков должны лететь капли / particles в progress bar;
- progress bar обновляется после или во время анимации;
- при достижении targetScore показать victory state.

---

## Молоток

При выборе молотка:

- показывать overlay 4×4;
- подсвечивать кубики, которые будут удалены;
- область должна перемещаться за пальцем / курсором;
- после применения кубики исчезают.

---

## Множитель

При активном множителе:

- показать `x2`;
- progress bar должен получить активное визуальное состояние;
- начисляемые очки должны умножаться на 2.

---

# Редактор уровня

Нужна страница:

```txt
/editor
```

Страница должна состоять из двух частей:

```txt
[левая панель редактора] [правая панель live preview]
```

## Левая панель

В левой панели:

- заголовок “Редактор уровней”;
- select для выбора шаблона уровня;
- форма редактирования параметров;
- ошибки валидации;
- кнопки:
  - “Применить”;
  - “Сбросить”;
  - “Копировать JSON”;
  - “Импорт JSON”;
- textarea с JSON-конфигом;
- возможность редактировать JSON вручную.

## Правая панель

В правой панели:

- mobile preview игры;
- aspect ratio 9:16;
- live preview должен использовать применённый config;
- после изменения формы preview обновляется только после “Применить”;
- при изменении JSON вручную preview тоже обновляется после “Применить”.

---

# Конфиг уровня

Нужно спроектировать тип `LevelConfig`.

Примерная структура:

```ts
type LevelConfig = {
  levelId: string;
  title: string;

  grid: {
    rows: number;
    cols: number;
  };

  targetScore: number;

  initialBoard: Array<Array<BoardCellConfig | null>>;

  figures: {
    availableShapeIds: string[];
    spawnWeights: Record<string, number>;
    colors: string[];
  };

  boosters: {
    collectAll: {
      enabled: boolean;
      initialCount: number;
    };
    multiplier: {
      enabled: boolean;
      initialCount: number;
      multiplierValue: number;
      duration: "until_level_end";
    };
    hammer: {
      enabled: boolean;
      initialCount: number;
      areaRows: number;
      areaCols: number;
    };
  };

  protectionFromLoss: {
    enabled: boolean;
    clearBoardCost: number;
  };

  visual: {
    backgroundId: string;
    cubeStyle: "pseudo3d";
    showDebugGrid: boolean;
  };
};
```

Нужно добавить:

```ts
normalizeLevelConfig(config: LevelConfig): LevelConfig
validateLevelConfig(config: LevelConfig): string[]
serializeLevelConfig(config: LevelConfig): string
parseJsonConfig(raw: string): LevelConfig
```

---

# Архитектура проекта

Предложенная структура:

```txt
src/
  app/
    editor/
      page.tsx

  entities/
    game/
      config/
        defaultLevels.ts
        figureShapes.ts
      model/
        types.ts
        validation.ts
        normalize.ts
      lib/
        board.ts
        figures.ts
        scoring.ts
        boosters.ts

  widgets/
    level-editor/
      ui/
        LevelEditor.tsx
        EditorForm.tsx
      model/
        useLevelEditor.ts
      styles/
        LevelEditor.module.scss
        EditorForm.module.scss

    game-core/
      ui/
        GameCore.tsx
      pixi/
        GameApplication.ts
        GameScene.ts
        BoardLayer.ts
        FigureLayer.ts
        EffectsLayer.ts
        HudLayer.ts
      model/
        gameStore.ts
        gameActions.ts
      styles/
        GameCore.module.scss

  shared/
    lib/
      deepEqual.ts
      random.ts
      clamp.ts
      uid.ts
```

Важно разделить:

- game logic;
- Pixi rendering;
- React editor UI;
- config validation;
- effects;
- types.

---

# Game logic functions

Чистые функции (актуальные сигнатуры, как в `entities/game/lib`):

```ts
// board.ts
createEmptyBoard(rows: number, cols: number, initialBoard?: Array<Array<BoardCellConfig|null>>): BoardCell[][];
canPlaceFigure(board: BoardCell[][], figure: FigureInstance, row: number, col: number): boolean;
placeFigure(board: BoardCell[][], figure: FigureInstance, row: number, col: number): BoardCell[][];
findCompletedLines(board: BoardCell[][]): CompletedLine[];
clearCompletedLines(board: BoardCell[][], lines: CompletedLine[]): ClearResult;
canPlaceAnyFigure(board: BoardCell[][], figures: FigureInstance[]): boolean;
// figures.ts
generateFigureSet(config: LevelConfig, board?: BoardCell[][]): FigureInstance[];
// scoring.ts
calculateScore(params: CalculateScoreParams): number;
checkWinCondition(score: number, targetScore: number): boolean;
checkLoseCondition(board: BoardCell[][], figures: FigureInstance[]): boolean;
// boosters.ts (работают с board, не с GameState)
applyCollectAll(board: BoardCell[][]): { board; clearedCellsCount; clearedCellCoords };
applyHammer(board: BoardCell[][], area: HammerArea): { board; clearedCellsCount; clearedCellCoords };
// gameFlow.ts — post-move резолвер (win / regenerate / lose / protection)
resolvePostMove(board, figures, score, config): { outcome; figures; regenerated };
```

> Мутации, завязанные на `GameState`, реализованы **не** чистыми функциями, а в Zustand-сторе ([gameStore.ts](src/widgets/game-core/model/gameStore.ts)): `activateMultiplier`, `clearBoardAndContinue`, `useBooster` и т.д. Исполнение бустеров с анимацией — в [GameScene.ts](src/widgets/game-core/pixi/GameScene.ts).

---

# Game state

Пример:

```ts
type GameStatus =
  | "idle"
  | "playing"
  | "dragging"
  | "booster_selecting"
  | "protection_from_loss"
  | "won"
  | "lost";

type GameState = {
  status: GameStatus;
  config: LevelConfig;
  board: BoardCell[][];
  currentFigures: FigureInstance[];
  score: number;
  targetScore: number;
  activeBooster: BoosterType | null;
  isMultiplierActive: boolean;
  boosterInventory: Record<BoosterType, number>;
};
```

---

# Этапы промптов для агента

Ниже — последовательные промпты. Их можно давать агенту по одному, чтобы он не пытался сделать всё сразу и не сломал архитектуру.

---

## Промпт 1. Подготовка проекта и архитектуры

```txt
Ты senior frontend/game developer. Нужно создать core-игру Block Blast-like в Next.js + React + TypeScript.

На этом этапе не реализуй полную игру. Подготовь архитектуру проекта, типы, конфиги и страницу /editor.

Требования:
1. Создай страницу src/app/editor/page.tsx.
2. Создай структуру папок:
   - entities/game
   - widgets/game-core
   - widgets/level-editor
   - shared/lib
3. Добавь типы для LevelConfig, BoardCell, FigureShape, FigureInstance, GameState, BoosterType.
4. Добавь 15 базовых фигур и DEFAULT_FIGURE_WEIGHTS.
5. Добавь DEFAULT_LEVELS с 2-3 тестовыми уровнями.
6. Добавь функции normalizeLevelConfig и validateLevelConfig.
7. Сделай базовый layout /editor:
   - слева панель редактора;
   - справа mobile preview 9:16;
   - пока preview может показывать placeholder.
8. Используй TypeScript и SCSS modules.
9. Не добавляй дерево, магазин, задания и другие мета-механики.
10. Код должен быть готов к следующему этапу, где будет добавлена игровая логика.
```

---

## Промпт 2. Чистая игровая логика

```txt
Продолжай проект. На этом этапе реализуй чистую игровую логику без Pixi-анимаций.

Нужно реализовать:
1. createEmptyBoard.
2. canPlaceFigure.
3. placeFigure.
4. findCompletedLines.
5. clearCompletedLines.
6. calculateScore.
7. generateFigureSet с учётом spawnWeights.
8. canPlaceAnyFigure.
9. checkWinCondition.
10. checkLoseCondition.

Правила:
- Поле 8×8 по умолчанию, но размеры должны браться из config.grid.
- Фигуры нельзя вращать.
- Фигура ставится только если все её клетки попадают в пустые клетки поля.
- Очки начисляются только за очищенные линии или бустеры.
- Если очищено 2 линии одновременно, multiplier x2; 3 линии — x3.
- В пересечении горизонтальной и вертикальной линии клетка считается один раз.
- Вода и очки — одно и то же.
- Добавь unit-like проверки или dev examples для основных функций.
- Не реализуй пока Pixi rendering.
```

---

## Промпт 3. Базовый Pixi game preview

```txt
Продолжай проект. Теперь реализуй базовый GameCore на Pixi.js.

Нужно:
1. Создать React client component GameCore.
2. Внутри GameCore инициализировать Pixi Application.
3. Сделать responsive mobile canvas 9:16.
4. Нарисовать:
   - фон;
   - поле 8×8;
   - пустые клетки;
   - верхний progress score 0/targetScore;
   - 3 фигуры в нижних слотах.
5. Кубики пока можно рисовать через Pixi Graphics.
6. Сделать псевдо-3D кубик:
   - основной цвет;
   - нижняя тёмная грань;
   - highlight;
   - тень;
   - скругления.
7. Preview должен брать LevelConfig из props.
8. При изменении key/config игра должна пересоздаваться.
9. Пока без drag-and-drop.
```

---

## Промпт 4. Drag-and-drop фигур

```txt
Продолжай проект. Добавь drag-and-drop для фигур.

Требования:
1. Фигуры в нижних слотах отображаются меньше, чем на поле.
2. Фигуры в слотах слегка левитируют.
3. При pointerdown фигура увеличивается до размера клеток поля.
4. Фигура следует за pointer.
5. При перемещении над полем вычислять ближайшую origin-клетку.
6. Если placement валидный — подсвечивать клетки, куда встанет фигура.
7. Если placement невалидный — показывать invalid state или убирать подсветку.
8. При pointerup:
   - если placement валидный, поставить фигуру на поле;
   - если placement невалидный, вернуть фигуру в домашний слот.
9. После установки фигуры сделать bounce-анимацию.
10. После установки всех 3 фигур сгенерировать новый набор.
11. После каждого placement проверить completed lines.
12. Пока анимацию очистки линий можно сделать простой.
```

---

## Промпт 5. Очистка линий, scoring и победа

```txt
Продолжай проект. Реализуй полноценную очистку линий, scoring и победу.

Требования:
1. После установки фигуры проверять горизонтальные и вертикальные линии.
2. Заполненные линии подсвечивать перед удалением.
3. Кубики в линиях должны исчезать через scale/fade/pop animation.
4. Очки начислять только после очистки линии.
5. Если очищено несколько линий одновременно, применять line multiplier:
   - 1 линия x1;
   - 2 линии x2;
   - 3 линии x3.
6. Если активен booster multiplier, дополнительно умножать очки на 2.
7. Добавить анимацию полёта воды/частиц от очищенных клеток в progress bar.
8. Progress bar должен обновляться после начисления.
9. Если score >= targetScore:
   - остановить игру;
   - показать victory overlay;
   - добавить кнопку restart.
```

---

## Промпт 6. Поражение и защита от поражения

```txt
Продолжай проект. Реализуй lose condition и protection from loss.

Правила:
1. После каждого хода проверять, можно ли поставить хотя бы одну из доступных фигур.
2. Если нельзя поставить ни одну фигуру, открыть overlay “Защита от поражения”.
3. В overlay показать:
   - текст “Короб заполнен” или “Нет доступных ходов”;
   - кнопку “Очистить поле и продолжить”;
   - кнопку “Завершить уровень”.
4. Если игрок выбирает очистку:
   - очистить всё поле;
   - не начислять очки, если это именно protection clear, если в конфиге не указано иначе;
   - продолжить игру.
5. Если игрок выбирает завершение:
   - установить status = lost;
   - показать lose overlay.
6. Если protectionFromLoss.enabled = false, сразу показывать lose overlay.
```

---

## Промпт 7. Бустеры

```txt
Продолжай проект. Добавь 3 бустера: Collect All, Multiplier, Hammer.

Бустеры должны быть видны в игровом UI.

1. Collect All:
   - очищает все блоки на поле;
   - начисляет очки за все очищенные блоки;
   - проигрывает анимацию воды в progress bar;
   - тратит 1 заряд.

2. Multiplier:
   - активируется до конца уровня;
   - умножает все будущие очки на 2;
   - показывает x2 под progress bar;
   - progress bar получает glow/pulse состояние;
   - тратит 1 заряд при активации.

3. Hammer:
   - переводит игру в режим выбора области;
   - область 4×4;
   - игрок может перемещать область по полю;
   - занятые кубики внутри области подсвечиваются;
   - по tap/release область применяется;
   - кубики исчезают;
   - начисляются очки за удалённые кубики;
   - тратит 1 заряд только после успешного применения;
   - если игрок отменил действие, заряд не тратится.

Важно:
- блокеров нет;
- бустеры должны работать и мышкой, и touch.
```

---

## Промпт 8. Редактор уровней

```txt
Продолжай проект. Реализуй полноценный редактор уровней на странице /editor.

Левая панель:
1. Заголовок “Редактор уровней”.
2. Select выбора шаблона DEFAULT_LEVELS.
3. Форма редактирования:
   - levelId;
   - title;
   - targetScore;
   - rows;
   - cols;
   - доступные фигуры;
   - spawnWeights;
   - booster counts;
   - multiplier value;
   - hammer area size;
   - protectionFromLoss enabled;
   - clearBoardCost;
   - visual options.
4. Кнопки:
   - Применить;
   - Сбросить;
   - Копировать JSON;
   - Импорт JSON.
5. Textarea с JSON.
6. Если JSON невалидный, показать ошибки.
7. Если config не проходит validateLevelConfig, показать ошибки.
8. Preview справа обновлять только после “Применить”.

Правая панель:
1. Mobile preview 9:16.
2. GameCore получает appliedConfig.
3. При применении нового конфига preview перезапускается.
```

---

## Промпт 9. Initial board editor

```txt
Продолжай проект. Добавь в редактор возможность настраивать initialBoard.

Требования:
1. В форме редактора добавить визуальную сетку 8×8.
2. По клику на клетку можно включать/выключать стартовый блок.
3. Для стартовых блоков можно выбрать цвет.
4. Изменения initialBoard должны отражаться в JSON.
5. После “Применить” preview должен стартовать с заданным initialBoard.
6. validateLevelConfig должен проверять, что initialBoard соответствует grid.rows/grid.cols.
```

---

## Промпт 10. Визуальная полировка

```txt
Продолжай проект. Улучши визуал и анимации.

Нужно:
1. Сделать деревянный фон, похожий на концепт.
2. Улучшить псевдо-3D кубики.
3. Добавить тени от фигур.
4. Добавить idle levitation для фигур в слотах.
5. Добавить smooth return animation при невалидном drop.
6. Добавить bounce при установке фигуры.
7. Улучшить line clear animation.
8. Улучшить water particles animation.
9. Улучшить hammer 4×4 highlight.
10. Улучшить multiplier active state.
11. Звук через howler (события: pick, place, invalid, line clear, booster, win, lose).
    Реализовано как заглушка `soundManager`: вызовы расставлены по коду, но реальных
    аудио-файлов пока нет → `play()` ничего не проигрывает. Чтобы включить — положить
    файлы в `public/sounds/` и заполнить `SOUND_FILES` в `shared/lib/sound.ts`.
    Включением звука управляет хост-приложение, тумблера в конфиге нет.
12. Эффекты (левитация, частицы, bounce, line clear, water) **всегда включены** —
    отдельного тумблера `visual.effectsEnabled` нет (убран намеренно). Антиалиасинг тоже всегда включён.
```

---

## Промпт 11. Финальная проверка и edge cases

```txt
Проверь проект и исправь edge cases.

Проверить:
1. Нельзя поставить фигуру за пределы поля.
2. Нельзя поставить фигуру поверх занятых клеток.
3. Фигура возвращается в слот при invalid drop.
4. Новый набор фигур появляется только после размещения всех 3.
5. Очки не начисляются при обычном placement без линии.
6. Очки начисляются при line clear.
7. Одновременные линии дают multiplier.
8. Пересекающиеся линии не дублируют score за общую клетку.
9. Multiplier работает до конца уровня.
10. Hammer удаляет только занятые клетки внутри 4×4.
11. Collect All очищает всё поле и начисляет очки.
12. Win останавливает игру.
13. Lose condition срабатывает, когда ни одну фигуру нельзя поставить.
14. Protection from loss работает.
15. Editor JSON import работает.
16. Editor JSON validation работает.
17. Preview перезапускается после Apply.
18. Игра работает на mobile touch.
19. Игра не ломается при resize.
20. Next build проходит без ошибок.
```

---

# Финальный объединённый промпт

Если нужно дать агенту один большой промпт сразу, можно использовать этот вариант.

```txt
Ты senior frontend/game developer. Нужно реализовать core-игру Block Blast-like с редактором уровней.

Стек:
- Next.js latest;
- React;
- TypeScript;
- Pixi.js для game rendering;
- SCSS modules;
- Zustand или локальный state для game state;
- Howler опционально для звуков.

Нужна одна страница: /editor.

На /editor:
- слева редактор уровня;
- справа live preview игры в формате мобильного экрана 9:16.

Важно:
Не реализовывать дерево, магазин, задания, мешочки, призы, Daily Streak, реальные API, авторизацию и бизнес-интеграции. Нужен только core игры.

Core:
- поле 8×8;
- игрок получает 3 фигуры;
- фигуры не падают сверху;
- фигуры перетаскиваются вручную;
- фигуры нельзя вращать;
- если placement валидный, клетки подсвечиваются;
- если placement невалидный, фигура возвращается в домашний слот;
- после установки всех 3 фигур генерируется новый набор;
- линии очищаются по горизонтали и вертикали;
- очки/вода начисляются только при очистке линий или при использовании бустера;
- очки и вода — одно и то же;
- progress отображается как 0/targetScore;
- при одновременной очистке 2 линий применяется x2, 3 линий x3 и так далее;
- победа при score >= targetScore;
- поражение, если ни одну из доступных фигур нельзя поставить;
- перед поражением показать protection from loss.

Бустеры:
1. Collect All:
   - очищает всё поле;
   - начисляет score за все блоки;
   - запускает water particles в progress bar.

2. Multiplier:
   - действует до конца уровня;
   - умножает будущий score на 2;
   - показывает x2 и active state progress bar.

3. Hammer:
   - выбирает область 4×4;
   - область можно перемещать по полю;
   - подсвечивает кубы, которые будут удалены;
   - удаляет кубы и начисляет score.

Блокеров нет.

Фигуры:
- использовать 15 shapes;
- у каждой shape есть id и cells;
- генерация по spawnWeights;
- фигуры в слотах меньше, чем кубики на поле;
- при выборе увеличиваются;
- в слотах слегка левитируют.

Визуал:
- vertical mobile-first;
- деревянный фон;
- псевдо-3D кубики;
- тени;
- bounce при placement;
- подсветка valid placement;
- line clear animation;
- water particles animation;
- hammer highlight;
- multiplier glow state.

Editor:
- select шаблона уровня;
- форма параметров;
- JSON textarea;
- Apply;
- Reset;
- Copy JSON;
- Import JSON;
- validation errors;
- live preview справа.

LevelConfig:
- levelId;
- title;
- grid rows/cols;
- targetScore;
- initialBoard;
- availableShapeIds;
- spawnWeights;
- booster settings;
- protectionFromLoss;
- visual settings.

Архитектура:
- отделить game logic от Pixi rendering;
- отделить editor UI от game core;
- чистые функции вынести в entities/game/lib;
- Pixi scene вынести в widgets/game-core/pixi;
- editor вынести в widgets/level-editor.

Нужно реализовать проект так, чтобы:
- /editor открывался и работал;
- игру можно было играть мышью и touch;
- preview обновлялся после применения конфига;
- Next build проходил без ошибок;
- основная игровая логика была без заглушек.
```

---

# Рекомендуемый порядок работы

Лучше не давать агенту сразу весь финальный промпт. Безопаснее идти этапами:

1. Архитектура, типы, `/editor`.
2. Чистая игровая логика.
3. Базовый Pixi preview.
4. Drag-and-drop.
5. Очистка линий, scoring, победа.
6. Поражение и защита от поражения.
7. Бустеры.
8. Редактор уровня.
9. Initial board editor.
10. Визуальная полировка.
11. Edge cases и build check.

Так агенту будет проще не потерять требования и не смешать core-игру с мета-слоем.
