# AnonBase Agent — План разработки и деплоя

**Версия:** 1.0  
**Дата:** 2026-02-27

---

## Как я вижу дальнейшую работу

### Общая логика

1. **Сначала** — локально поднять агента и один job, проверить, что всё работает.
2. **Потом** — определиться с остальными jobs и skills под них.
3. **Затем** — GitHub, сервер, 24/7.
4. **В конце** — токен, когда агент стабильно выполняет jobs.

### Пошаговый roadmap

| Фаза | Что делаем | Результат |
|------|------------|-----------|
| **Фаза 0** | Создать папку AnonBaseAgent, клонировать openclaw-acp, `npm install`, `acp setup` | Агент зарегистрирован на aGDP, есть config.json |
| **Фаза 1** | Выбрать 1 job для MVP (из списка или свой). Сделать `acp sell init`, написать handlers.ts с human_summary | Один рабочий offering |
| **Фаза 2** | `acp sell create`, `acp serve start`. Проверить на agdp.io и через Butler | Агент принимает jobs, возвращает результат |
| **Фаза 3** | Profile description с ключевыми словами. При необходимости — skills из ClawHub | Discoverability, агенты находят через acp browse |
| **Фаза 4** | Добавить 1–2 jobs. Подобрать skills под них (если нужны) | 2–3 offerings |
| **Фаза 5** | Кэш в handlers (обучение, уровень 1) | Агент переиспользует успешные ответы |
| **Фаза 6** | .gitignore, git init, push в GitHub | Репо готов для деплоя |
| **Фаза 7** | VPS / Railway, клонировать, config.json, PM2 | Агент работает 24/7 |
| **Фаза 8** | Запустить токен (когда есть стабильные jobs) | aGDP rewards, leaderboard |

### Что делать прямо сейчас

1. **Создать папку** `C:\Users\Pc\Desktop\AnonBaseAgent`
2. **Клонировать** openclaw-acp, `npm install`
3. **Запустить** `npx tsx bin/acp.ts setup` — логин, создание агента AnonBase Sentinel (токен не запускать)
4. **Выбрать первый job** — один из: ecosystem_health_check, agent_vetting, base_ecosystem_snapshot (или из SKILLS_AND_JOBS_RESEARCH.md)
5. **Сделать** `acp sell init <name>`, написать handlers.ts, `acp sell create`
6. **Запустить** `acp serve start`, проверить на agdp.io

### Решения, которые нужно принять

| Вопрос | Варианты |
|--------|----------|
| Первый job | ecosystem_health_check / agent_vetting / base_ecosystem_snapshot / свой |
| Skills для OpenClaw | ACP (обязательно) + tavily / github / другие — под выбранные jobs |
| Хостинг | Railway (проще) / VPS + PM2 (больше контроля) |

### Порядок файлов и команд

```
1. mkdir AnonBaseAgent && cd AnonBaseAgent
2. git clone https://github.com/Virtual-Protocol/openclaw-acp.git
3. cd openclaw-acp && npm install
4. npx tsx bin/acp.ts setup
5. npx tsx bin/acp.ts sell init <job_name>
6. Редактировать src/seller/offerings/<agent>/<job>/offering.json
7. Редактировать src/seller/offerings/<agent>/<job>/handlers.ts
8. npx tsx bin/acp.ts sell create <job_name>
9. npx tsx bin/acp.ts profile update description "..."
10. npx tsx bin/acp.ts serve start
```

### Когда переходить к следующей фазе

- **Фаза 0 → 1:** когда `acp whoami` показывает твоего агента
- **Фаза 1 → 2:** когда handlers.ts написан и offering зарегистрирован
- **Фаза 2 → 3:** когда тестовый job выполняется успешно
- **Фаза 3 → 6:** когда агент стабильно работает локально
- **Фаза 6 → 7:** когда репо в GitHub, .gitignore настроен
- **Фаза 7 → 8:** когда агент 24/7 на сервере и выполняет jobs

---

## Твоя концепция

1. Создать агента на **aGDP** (токен пока не запускать)
2. **Основа:** OpenClaw + Virtuals из их GitHub — [openclaw-acp](https://github.com/Virtual-Protocol/openclaw-acp)
3. **Skills:** доступ из экосистемы OpenClaw (ClawHub, ClawSkills и т.д.)
4. Продумать и реализовать **jobs (offerings)**
5. Всё делать **локально**
6. Загрузить в **GitHub**
7. Купить **сервер**
8. Установить на сервер всё необходимое и загрузить агента из GitHub для работы **24/7**

---

## Позиционирование: Вариант 1 + 2 + экосистема агентов

### Связка

| Уровень | Связь |
|---------|-------|
| **Бренд** | From AnonBase team (Вариант 1) |
| **Сеть** | Base ecosystem — где живёт AnonBase (Вариант 2) |
| **Платформа** | **aGDP** — маркетплейс, где агент продаёт и покупает |
| **Взаимодействие** | **Virtuals-агенты** + **OpenClaw-агенты** + **люди через Butler** |

### Где живёт и с кем взаимодействует

```
                    AnonBase Sentinel
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   aGDP платформа    Virtuals агенты    OpenClaw агенты
   (маркетплейс)    (app.virtuals.io)   (gateway + skills)
        │                  │                  │
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    Butler (люди)
                    app.virtuals.io/acp
```

### Кто с ним взаимодействует

| Кто | Как |
|-----|-----|
| **Virtuals-агенты** | Через ACP: acp browse → acp job create. Тот же маркетплейс, те же jobs. |
| **OpenClaw-агенты** | С ACP skill в extraDirs: acp browse, acp job create. Находят Sentinel, создают jobs. |
| **Люди** | Через Butler на app.virtuals.io — Butler ищет агента, создаёт job, человек видит human_summary. |
| **aGDP** | Платформа: offerings видны на agdp.io, leaderboard, discoverability. |

### Jobs — для кого и зачем

Jobs должны быть полезны **агентам** (Virtuals, OpenClaw) и **людям** (Butler):

- Агент ищет другого агента → `acp browse` → находит Sentinel
- Агент создаёт job → Sentinel выполняет → возвращает JSON + human_summary
- Человек через Butler задаёт запрос → Butler создаёт job → человек получает читаемый результат

**Вывод:** Jobs проектируются под взаимодействие с Virtuals/OpenClaw-агентами и людьми на aGDP. Base — сеть и экосистема. AnonBase team — бренд.

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────────┐
│  ОСНОВА (обязательно)                                               │
│  openclaw-acp с GitHub Virtual-Protocol                             │
│  https://github.com/Virtual-Protocol/openclaw-acp                  │
│  → ACP, маркетплейс, Seller Runtime, wallet, browse, job create    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SKILLS (из экосистемы OpenClaw)                                    │
│  Источники:                                                         │
│  • https://clawhub.ai/skills?sort=downloads                         │
│  • https://clawskills.site/                                          │
│  • https://openclawskills.dev/                                       │
│  • https://docs.openclaw.ai/                                         │
│  • https://openclawsearch.com/                                       │
│                                                                     │
│  Установка: npx clawhub@latest install <skill-slug>                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  JOBS (offerings) — твои услуги                                     │
│  acp sell init <name> → handlers.ts + offering.json                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Этап 1: Локальная разработка

### 1.1 Подготовка

- [ ] Node.js 22+
- [ ] Git
- [ ] Папка: `C:\Users\Pc\Desktop\AnonBaseAgent`

### 1.2 Основа — openclaw-acp

```bash
cd AnonBaseAgent
git clone https://github.com/Virtual-Protocol/openclaw-acp.git
cd openclaw-acp
npm install
npx tsx bin/acp.ts setup
```

- Логин, создание агента (AnonBase Sentinel)
- Токен **не запускать**
- Проверить появление `config.json` (не коммитить!)

### 1.3 OpenClaw + Skills

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Конфиг `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "load": {
      "extraDirs": ["C:/Users/Pc/Desktop/AnonBaseAgent/openclaw-acp"]
    }
  }
}
```

**Skills из ClawHub** (примеры, смотреть на clawhub.ai / clawskills.site):

```bash
npx clawhub@latest install virtuals-protocol-acp
npx clawhub@latest install tavily-web-search
npx clawhub@latest install github
```

*(Точные slug смотреть на clawhub.ai или clawskills.site)*

### 1.4 Jobs (offerings)

Продумать и создать:

| Job | Описание | Цена | Статус |
|-----|----------|------|--------|
| ecosystem_health_check | Проверка здоровья агента/токена в экосистеме Base/Virtuals | $0.02–0.05 | [ ] |
| token_due_diligence | Анализ токена: holders, liquidity, риски | $0.03–0.05 | [ ] |
| agent_vetting | Due diligence агента на Virtuals | $0.02–0.03 | [ ] |

Команды:

```bash
cd openclaw-acp
npx tsx bin/acp.ts sell init ecosystem_health_check
# Редактировать offering.json + handlers.ts
npx tsx bin/acp.ts sell create ecosystem_health_check
```

В каждом `handlers.ts` — **human_summary** в deliverable (для Butler).

### 1.5 Проверка локально

```bash
npx tsx bin/acp.ts serve start
```

Проверить на agdp.io, что агент и offerings видны.

---

## Этап 2: GitHub

### 2.1 Структура репозитория

```
AnonBaseAgent/
├── openclaw-acp/           # Клонированный репо (или submodule)
│   ├── src/seller/offerings/<agent-name>/
│   ├── config.json         # НЕ коммитить! Добавить в .gitignore
│   └── ...
├── .gitignore              # config.json, node_modules, .env
├── README.md
├── deploy.md               # Инструкция для сервера
└── ANONBASE_AGENT_PLAN.md  # Этот файл
```

### 2.2 Что НЕ коммитить

- `config.json` (credentials)
- `node_modules`
- `.env`
- `active-bounties.json`

### 2.3 Создание репо

```bash
cd AnonBaseAgent
git init
# Добавить .gitignore
git add .
git commit -m "Initial: AnonBase Sentinel agent"
git remote add origin https://github.com/<user>/AnonBaseAgent.git
git push -u origin main
```

---

## Этап 3: Сервер для 24/7

### 3.1 Требования к серверу

- Ubuntu 22.04+ (или аналог)
- Node.js 22+
- 2+ GB RAM
- Стабильный интернет

Варианты: VPS (DigitalOcean, Hetzner, Timeweb), Railway, или свой сервер.

### 3.2 Установка на сервер

```bash
# 1. Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Клонировать репо
git clone https://github.com/<user>/AnonBaseAgent.git
cd AnonBaseAgent/openclaw-acp

# 3. Установить зависимости
npm install

# 4. Настроить config.json (скопировать с локальной машины или acp setup)
npx tsx bin/acp.ts setup
# или вручную создать config.json с LITE_AGENT_API_KEY и т.д.

# 5. OpenClaw (если нужен gateway)
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

### 3.3 Запуск 24/7 (PM2 или systemd)

**PM2:**

```bash
npm install -g pm2
cd AnonBaseAgent/openclaw-acp
pm2 start "npx tsx bin/acp.ts serve start" --name anonbase-sentinel
pm2 save
pm2 startup
```

**Или Railway:**

```bash
npx tsx bin/acp.ts serve deploy railway setup
npx tsx bin/acp.ts serve deploy railway
```

### 3.4 Обновление с GitHub

```bash
cd AnonBaseAgent
git pull
cd openclaw-acp && npm install
pm2 restart anonbase-sentinel
```

---

## Источники Skills

| Сайт | Назначение |
|------|------------|
| [clawhub.ai/skills](https://clawhub.ai/skills?sort=downloads) | Установка: `npx clawhub@latest install <slug>` |
| [clawskills.site](https://clawskills.site/) | Каталог по категориям, install-команды |
| [openclawskills.dev](https://openclawskills.dev/) | Дополнительный каталог |
| [docs.openclaw.ai](https://docs.openclaw.ai/) | Документация OpenClaw |
| [openclawsearch.com](https://openclawsearch.com/) | Обзор экосистемы, хостинг |

---

## Чеклист

### Локально
- [ ] Клонировать openclaw-acp
- [ ] acp setup (без токена)
- [ ] OpenClaw + extraDirs
- [ ] Установить skills из ClawHub
- [ ] Создать 1+ offering
- [ ] human_summary в deliverable
- [ ] acp serve start — проверить

### GitHub
- [ ] .gitignore (config.json и т.д.)
- [ ] git push

### Сервер
- [ ] Купить VPS / настроить Railway
- [ ] Клонировать, npm install
- [ ] config.json
- [ ] PM2 / systemd для 24/7

### Позже
- [ ] Запустить токен (когда агент стабильно работает)

---

## Skills — какие добавить и зачем

**Важно:** Seller Runtime (handlers.ts) выполняет jobs — это обычный TypeScript. Skills из ClawHub нужны для **OpenClaw-агента**, когда он работает как conversational agent (gateway). Для выполнения jobs handlers используют **API напрямую** (fetch, npm-пакеты).

### Skills для OpenClaw-агента (если запускаешь gateway)

| Skill | Slug (пример) | Зачем |
|-------|---------------|------|
| **ACP** | openclaw-acp (extraDirs) | browse, job create, wallet — взаимодействие с маркетплейсом |
| **Tavily Web Search** | tavily-search | Поиск для анализа, sentiment, due diligence |
| **GitHub** | github | Анализ репозиториев (integrity, vetting) |
| **self-improving-agent** | self-improving-agent | Сохранение ошибок и исправлений для обучения |

Установка:
```bash
npx clawhub@latest install tavily-search
npx clawhub@latest install github
npx clawhub@latest install self-improving-agent
```

### Что handlers.ts использует (не skills, а API)

Для выполнения jobs в `handlers.ts` вызываются API:

| Источник | Для чего |
|----------|----------|
| DEXScreener API | Данные по токенам (price, liquidity, holders) |
| Basescan / Base RPC | On-chain данные |
| agdp.io / Virtuals API | Информация об агентах |
| Tavily API (опционально) | Web search из handlers |
| GitHub API | Репозитории, контракты |

---

## Обучение агента

### Уровень 1: Кэш в handlers (простой)

В `handlers.ts` сохранять успешные ответы:

```typescript
// Псевдокод
const cacheFile = path.join(__dirname, '../../.learning-cache.json');
const cache = loadCache(cacheFile);

// Похожий запрос? Вернуть адаптированный ответ
const similar = findSimilar(cache, requirements);
if (similar) {
  return adaptResponse(similar, requirements);
}

const result = await executeJobLogic(requirements);
saveToCache(cacheFile, { requirements, result });
return result;
```

### Уровень 2: Файл с паттернами

`learning/patterns.json`:
```json
{
  "token_analysis": {
    "common_queries": ["holder count", "liquidity", "contract"],
    "good_responses": [...],
    "avoid": ["timeout", "rate limit"]
  }
}
```

Handlers читают паттерны и улучшают ответы.

### Уровень 3: self-improving-agent skill

Skill из ClawHub записывает ошибки и исправления. Агент при следующем запросе может учитывать прошлый опыт.

### Рекомендация

Старт: **Уровень 1** — кэш в handlers. Позже добавить паттерны и self-improving-agent.

---

## Jobs — конкретные offerings

### Критерии

- **Клиенты:** Virtuals-агенты, OpenClaw-агенты, люди через Butler (aGDP)
- **Связь с брендом:** From AnonBase team, Base ecosystem
- Не дублировать массу аналогичных (trending_tokens, swap и т.п.)
- Реализуемо через API (DEXScreener, Basescan, agdp, Virtuals API)

### Предлагаемые jobs

| Job | Описание | Requirements | Цена | Сложность |
|-----|----------|--------------|------|-----------|
| **ecosystem_health_check** | Проверка здоровья агента или токена в экосистеме Base/Virtuals. On-chain метрики, ликвидность, holders, риски. | `agentId` или `tokenAddress` | $0.03 | Средняя |
| **token_due_diligence** | Анализ токена на Base: holders, liquidity, age, contract, DEXScreener-данные. | `tokenAddress` | $0.03 | Низкая |
| **agent_vetting** | Due diligence агента на Virtuals: offerings, активность, токен. | `agentId` | $0.02 | Средняя |
| **base_ecosystem_snapshot** | Краткий снимок экосистемы Base/Virtuals: топ агенты, объём, тренды. | — | $0.02 | Низкая |

### Requirements schema (пример)

**ecosystem_health_check:**
```json
{
  "agentId": "string (optional)",
  "tokenAddress": "string (optional)",
  "chain": "base"
}
```

**token_due_diligence:**
```json
{
  "tokenAddress": "string (required)",
  "chain": "base"
}
```

### human_summary (обязательно для Butler)

```typescript
const deliverable = {
  // JSON для агентов
  agentId: "...",
  score: 75,
  metrics: { ... },
  // Читаемый текст для людей в Butler
  human_summary: `🛡️ ECOSYSTEM HEALTH CHECK\n✅ Score: 75/100\n📊 Liquidity: $43K\n💡 Recommendation: ...`
};
return { deliverable: JSON.stringify(deliverable) };
```

---

## Итоговая схема взаимодействия

```
Другие агенты (OpenClaw + ACP)     Люди (Butler на app.virtuals.io)
         │                                    │
         │  acp browse "health" / "token"     │  Запрос через Butler
         │  acp job create <wallet> ...       │
         └────────────────┬───────────────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │  ACP Marketplace        │
              │  (agdp.io / Virtuals)   │
              └────────────┬───────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │  Твой Seller Runtime    │
              │  (acp serve start)      │
              │  executeJob()           │
              │  → human_summary         │
              └─────────────────────────┘
```
