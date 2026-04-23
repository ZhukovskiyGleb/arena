# Arena — План розробки

## Фаза 0 — Ініціалізація проєкту

- [x] Створити проєкт: `npm create vite@latest arena -- --template vanilla-ts`
- [x] Встановити залежності: `phaser`, `mobx` (або обійтись EventEmitter)
- [x] Встановити dev-залежності: `vitest`, `@types/node`
- [x] Налаштувати `vite.config.ts` для Phaser (alias, asset handling)
- [x] Налаштувати `tsconfig.json`: strict mode, paths
- [x] Налаштувати `vitest.config.ts` з coverage
- [x] Створити базову структуру папок згідно з DOC.md (`src/core`, `src/scene`, `src/state`, `src/ui`, `src/utils`)
- [x] Додати Phaser до `main.ts`, запустити порожню сцену — перевірити що відкривається у браузері

---

## Фаза 1 — Ядро (core logic)

### 1.1 Утиліти

- [x] `utils/random.ts` — `Random(X)`: рівномірне ціле з `[max(1, floor(X/5)), X]`; підтримка seed для детермінованих тестів
- [x] `utils/hexMath.ts` — cube coords `(q,r,s)`, функції: `hexDistance` (`(|Δq|+|Δr|+|Δs|)/2`), `hexNeighbors`, `hexRing(radius)`, `polarToHex`, `hexToPixel`, `pixelToHex` (pointy-top)

### 1.2 Персонаж та зброя

- [x] `core/character.ts` — інтерфейси `CharacterStats`, `CharacterSetup`; `CharacterState` (включає `knockedOut`, `position: HexCoord`, `initOrder`); функція `randomStats(total=30)`
- [x] `core/weapons.ts` — `WeaponType`, `WeaponConfig`, каталог `WEAPONS` (6 типів: SS, AA, II, SA, AI, IS) з `stat1`, `stat2`, `fatigueCost`

### 1.3 Бойові формули

- [x] `core/combat.ts` — `rollDamage(weapon, stats)`: `Random(Stat1 + Stat2)`; `rollDefense(S, knockedOut)`: `Random(S)` або `0`; `calcNetDamage(D, Def)`: `max(0, D-Def)`
- [x] `core/combat.ts` — `distributeNetDamage(netD, S, A, I)`: перевірка вбивчого удару (`netD >= HP`), пропорційний розподіл `apply = min(netD, caps)`, два проходи округлення
- [x] Тести `tests/combat.test.ts`

### 1.4 Ініціатива

- [x] `core/initiative.ts` — `rollInitiative(A)`: `Random(A)`; `sortTurnOrder(characters[])`: спадання Initiative, тай-брейк каскадно: більша `A` → більша `S+A+I` → менший `initOrder`
- [x] Тести `tests/initiative.test.ts`

### 1.5 Пересування

- [x] `core/movement.ts` — `findReference(characters[])` (еталон для групи та дуелі)
- [x] `core/movement.ts` — `calcSteps(charA, refA)` (формула ratio + clamp [1,5])
- [x] `core/movement.ts` — `reachableHexes(origin, steps, occupied[])` (BFS; союзники непрохідні)
- [x] Тести `tests/movement.test.ts`

### 1.6 Втома та непритомність

- [x] `core/fatigue.ts` — `applyActionCost(state, cost)` → `{ newF, knockedOut }`; вартість: крок=1, атака=fatigueCost зброї
- [x] `core/fatigue.ts` — `resetFatigue(state)` (початок ходу: F=0, knockedOut=false)
- [x] Тести `tests/fatigue.test.ts`

### 1.7 Стартові позиції

- [x] `core/spawn.ts` — `calcStartPositions(n)`: рівномірне коло з радіусом R з таблиці "Розмір поля" DOC.md; усунення колізій через `hexRing` (гарантує унікальні позиції)
- [x] Тести `tests/spawn.test.ts`

---

## Фаза 2 — Стан гри

- [x] `state/SetupState.ts` — список 8 слотів, методи `activateSlot`, `deactivateSlot`, `updateCharacter`, `validate`; дефолти (Char1=Player/Team1, Char2=AI/Team2)
- [x] `state/BattleState.ts` — поточний раунд, черга ходів, активний персонаж, статуси (живий/мертвий/knocked); методи `nextTurn`, `applyDamage`, `checkBattleEnd` (одна команда жива)

---

## Фаза 3 — Setup Screen

- [x] `ui/CharacterCard.ts` — +/− кнопки для S/A/I (сума завжди 100), вибір зброї ◄/►, toggle ГРАВЕЦЬ/AI, color picker (8 кольорів)
- [x] Реалтайм-перерозподіл: зміна одного стату переносить різницю на інший (сума 100 завжди)
- [x] `scene/SetupScene.ts` — сітка 2×4 карток; кнопка `+ Додати персонажа`; кнопка ✕ (деактивація, якщо активних > 2)
- [x] Кнопка **ГОТОВО**: активна тільки при валідному `SetupState`; при натисканні → перехід до BattleScene

---

## Фаза 4 — Battle Screen (Arena)

### 4.1 Гексагональна сітка

- [x] `scene/HexGrid.ts` — рендер сітки **pointy-top**, адаптивний розмір поля (з таблиці DOC.md), хіттест (клік → hex coords)
- [x] Підсвітка гексів: доступні кроки — синій, доступні атаки (суміжні, дальність 1) — червоний, наведення — жовтий

### 4.2 Токени персонажів

- [x] `scene/CharacterToken.ts` — коло кольору команди, мінібар HP
- [x] Анімація переміщення (tween), анімація смерті; індикатор KnockedOut

### 4.3 UI арени

- [x] `scene/TurnOrderBar.ts` — горизонтальний ряд карток зверху: `S/A/I`, ініціатива, зброя, колір команди; активна — виділена, відіграні — приглушені
- [x] Панель активного персонажа (знизу): `S / A / I`, `F / I`, залишок кроків
- [x] Лог подій: "Char1 → Char2 D:X Def:Y Net:Z"

### 4.4 Ігровий цикл

- [x] `scene/BattleScene.ts` — ініціалізація, токени на стартових позиціях
- [x] Хід **гравця**: split-movement; клік на ворога → атака (max 1 за хід); кнопка "End Turn"
- [x] Хід **AI**: рухатись до найближчого ворога, атакувати якщо суміжний, зупинитись перед нокаутом
- [x] Перевірка смерті після кожної атаки; екран результату
- [x] `core/movement.ts` — `findPath(from, to, occupied, fieldRadius)` BFS

---

## Фаза 5 — AI контролер

- [x] `core/ai.ts` — `decideTurn(state, char, fieldRadius)` → `AiAction[]`
- [x] Базова стратегія: рухатись до найближчого ворога → атакувати якщо суміжний → завершити хід до нокауту
- [x] Пріоритизація цілей: серед однаково далеких — атакує з найменшим HP
- [x] BattleScene рефакторено: AI-виконання через `executeAiActions`

---

## Фаза 6 — Result Screen

- [x] `scene/ResultScene.ts` — відображення переможця (колір команди + назва), кількість раундів
- [x] Кнопка **Play Again**: перезапустити BattleScene з тими ж налаштуваннями
- [x] Кнопка **New Setup**: повернутись до SetupScene

---

## Фаза 7 — Полірування та тести

- [x] Прогнати всі unit-тести: 148 тестів, 10 файлів — всі зелені
- [x] Coverage `core/`: Statements 97.1%, Branches 87.5%, Functions 100%, Lines 97.8%
- [x] `tests/invariants.test.ts` — всі 8 інваріантів з DOC.md §8 + граничні кейси
- [x] Граничні кейси: дуель (2 персонажі), one-shot kill, fatigue knockout
- [x] `findPath` — 6 тестів (пустий шлях, суміжний, заблокований, поза полем)
- [x] `getFieldConfig` — fallback для N поза таблицею
- [x] initiative `?? 0` fallback
- [x] Scale.FIT встановлено в main.ts з фази 0

---

## Порядок пріоритетів

```
Фаза 0 → Фаза 1 (ядро + тести) → Фаза 2 (стан) → Фаза 3 (Setup UI)
→ Фаза 4.1–4.2 (сітка + токени) → Фаза 4.4 (ігровий цикл)
→ Фаза 5 (AI) → Фаза 4.3 (UI арени) → Фаза 6 (Result) → Фаза 7 (polish)
```

**Мінімальний білд "граємо вже зараз":** Фази 0–4 без AI (обидва персонажі керуються гравцем по черзі).
