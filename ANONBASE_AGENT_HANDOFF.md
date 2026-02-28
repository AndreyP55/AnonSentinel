# AnonBase Agent — Полный план и handoff для нового чата

**Цель документа:** Открыть новый проект в Cursor, создать агента на Virtuals с OpenClaw + ACP, и передать весь контекст новому AI-ассистенту в одном файле.

---

## Часть 1: Контекст (всё, что обсуждалось 2 дня)

### Проект AnonBase

- **AnonBase** — privacy-протокол на Base (shielded deposits, private withdrawals, relayer, anonymity set).
- **Текущее состояние:** есть токен, сайт, твиттер. Реального агента нет.
- **Пост в феврале:** команда работает с Virtuals над интеграцией в ACP. «Скоро объявления».

### Цели нового агента

| Цель | Описание |
|-----|----------|
| Заработок | В первую очередь на запуске токена и агента |
| Не трогать AnonBase | Не отнимать внимание, не провоцировать продажи токена AnonBase |
| Одна команда | Разные токены, разные агенты, один бренд |
| Первый реальный продукт | Новый агент = первый функциональный продукт от команды AnonBase |
| Агенты должны пользоваться | Другие агенты и люди должны реально контактировать и использовать |
| Аудитория | Крипто, AI-трейдеры, торговля агентами и щитками |

### Что НЕ подошло (отклонённые идеи)

- Privacy helper (address check, pool recommendation, howto)
- Agent screener / alpha / rankings
- Content agent (мемы, твиты)
- Base Chain Data (gas, price, balance)
- Lottery, coin flip, dice
- Research agent, web automation

### Рекомендация GPT (из внешнего совета)

**Концепция:** AnonBase Sentinel / AnonBase Intelligence — intelligence layer, не CEO, не управление.

**Две роли:**
1. **Metrics & Integrity** — мониторинг, integrity checks, on-chain activity, token/ecosystem analysis
2. **Market & Ecosystem Intelligence** — market sentiment, smart money flow, token due diligence

**Позиционирование:** «This is not a new product. This is AnonBase becoming autonomous.»

**Возможные offerings (реализуемые через ACP handlers):**
- `integrity_scan` — проверка агента/протокола
- `token_due_diligence` — анализ токена
- `market_sentiment` — sentiment по рынку/токену
- `virtuals_token_analysis` — метрики токенов Virtuals

### Технический стек

- **Virtuals** — app.virtuals.io, agdp.io (создание агента, токен, маркетплейс)
- **OpenClaw** — gateway для агентов (docs.openclaw.ai)
- **ACP (openclaw-acp)** — browse, job create, sell, wallet, token
- **ClawHub** — skills для OpenClaw (clawhub.ai, clawskills.site, openclawskills.dev)

### Различие: Skills vs Offerings

| | ClawHub Skills | ACP Offerings |
|---|----------------|---------------|
| Что это | Возможности агента (поиск, браузер, анализ) | Услуги, которые агент продаёт |
| Откуда | clawhub install \<skill\> | acp sell init → handlers.ts |
| Кто использует | Твой агент | Другие агенты и люди |

---

## Часть 2: Детальный план — Вариант A (OpenClaw + ACP)

### Этап 0: Подготовка (перед открытием Cursor)

1. Убедись, что установлены:
   - Node.js 22+
   - npm или pnpm
   - Git

2. Создай папку для проекта:
   ```
   C:\Users\Pc\Desktop\AnonBaseAgent
   ```
   (или другое имя — AnonBaseSentinel, AnonBaseIntelligence)

### Этап 1: Создание проекта в Cursor

1. Открой Cursor.
2. File → Open Folder → выбери `C:\Users\Pc\Desktop\AnonBaseAgent`.
3. Создай новый чат (New Chat).
4. **Скопируй этот документ целиком в первый месседж** и добавь:
   ```
   Прочитай этот handoff. Мне нужно настроить агента на Virtuals с OpenClaw + ACP (полный вариант).
   Начни с Этапа 2.
   ```

### Этап 2: Клонирование и настройка openclaw-acp

1. В корне проекта (`AnonBaseAgent/`) выполни:
   ```bash
   git clone https://github.com/Virtual-Protocol/openclaw-acp.git
   cd openclaw-acp
   npm install
   ```

2. Запусти setup:
   ```bash
   npx tsx bin/acp.ts setup
   ```
   - Пройди логин (перейди по ссылке, авторизуйся)
   - Создай или выбери агента (например, AnonBaseSentinel)
   - При необходимости — запусти токен
   - Добавь ACP в preferred skill

3. Проверь, что появился `config.json` (не коммитить в git).

### Этап 3: Установка OpenClaw и ClawHub skills

1. Установи OpenClaw глобально:
   ```bash
   npm install -g openclaw@latest
   ```

2. Инициализируй OpenClaw (если ещё не делал):
   ```bash
   openclaw onboard --install-daemon
   ```

3. Добавь ACP skill в OpenClaw. В корне проекта или в `~/.openclaw/openclaw.json`:
   ```json
   {
     "skills": {
       "load": {
         "extraDirs": ["C:/Users/Pc/Desktop/AnonBaseAgent/openclaw-acp"]
       }
     }
   }
   ```
   Путь замени на свой.

4. Опционально — дополнительные skills (если нужны для offerings):
   ```bash
   npx clawhub@latest install virtuals-protocol-acp
   npx clawhub@latest install tavily-web-search
   ```
   (tavily требует API key)

### Этап 4: Создание offerings

1. Создай offering (пример — integrity_scan):
   ```bash
   cd openclaw-acp
   npx tsx bin/acp.ts sell init integrity_scan
   ```

2. Отредактируй:
   - `src/seller/offerings/<agent-name>/integrity_scan/offering.json` — описание, цена, requirement schema
   - `src/seller/offerings/<agent-name>/integrity_scan/handlers.ts` — логика executeJob

3. Зарегистрируй:
   ```bash
   npx tsx bin/acp.ts sell create integrity_scan
   ```

4. Повтори для других offerings (token_analysis, market_sentiment и т.д.).

### Этап 5: Запуск Seller Runtime

1. Локально:
   ```bash
   npx tsx bin/acp.ts serve start
   ```

2. Или деплой на Railway (24/7):
   ```bash
   npx tsx bin/acp.ts serve deploy railway setup
   npx tsx bin/acp.ts serve deploy railway
   ```

### Этап 6: Профиль и discoverability

1. Обнови описание агента:
   ```bash
   npx tsx bin/acp.ts profile update description "AnonBase Sentinel — ecosystem monitoring, integrity checks, market analytics. From AnonBase team." --json
   ```

2. Проверь на agdp.io, что агент и offerings видны.

---

## Часть 3: Структура проекта (целевая)

```
AnonBaseAgent/
├── openclaw-acp/                    # Клонированный репо
│   ├── bin/acp.ts
│   ├── src/
│   │   ├── commands/
│   │   ├── lib/
│   │   └── seller/
│   │       ├── runtime/
│   │       ├── offerings/
│   │       │   └── anonbase_sentinel/   # или имя твоего агента
│   │       │       ├── integrity_scan/
│   │       │       │   ├── offering.json
│   │       │       │   └── handlers.ts
│   │       │       └── token_analysis/
│   │       │           ├── offering.json
│   │       │           └── handlers.ts
│   │       └── resources/
│   ├── config.json                  # Не коммитить!
│   ├── SKILL.md
│   └── package.json
├── ANONBASE_AGENT_HANDOFF.md        # Этот файл
└── README.md                        # Краткое описание проекта
```

---

## Часть 4: Референсы (что читать агенту)

| Файл | Путь | Зачем |
|------|------|-------|
| ACP SKILL | openclaw-acp/SKILL.md | Все команды ACP |
| Seller reference | openclaw-acp/references/seller.md | Как создавать offerings |
| ACP Job | openclaw-acp/references/acp-job.md | browse, job create, status |
| AgentPulse пример | AgentPulse/openclaw-acp/.../agentpulse/ | Референс структуры offerings |

---

## Часть 5: Чеклист для нового чата

Когда откроешь новый чат в Cursor и вставишь этот документ, попроси агента:

- [ ] Прочитать Part 1 (контекст) полностью
- [ ] Создать структуру папок по Part 3
- [ ] Выполнить Этап 2 (клонирование openclaw-acp, npm install, acp setup)
- [ ] Выполнить Этап 3 (OpenClaw, openclaw.json)
- [ ] Создать минимум 1 offering (integrity_scan или token_analysis) по Этапу 4
- [ ] Зарегистрировать offering и проверить serve start

---

## Часть 6: Важные ссылки

- [OpenClaw docs](https://docs.openclaw.ai/)
- [ClawHub skills](https://clawhub.ai/skills)
- [ClawSkills directory](https://clawskills.site/)
- [Virtuals app](https://app.virtuals.io/)
- [aGDP.io](https://agdp.io/)
- [openclaw-acp GitHub](https://github.com/Virtual-Protocol/openclaw-acp)

---

**Версия:** 1.0  
**Дата:** 2026-02-27  
**Создано для:** Handoff в новый чат Cursor при создании AnonBase Sentinel / AnonBase Intelligence agent
