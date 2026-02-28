# Skills и Jobs — детальный разбор

**Цель:** Разобраться в skills и придумать jobs, которые не дублируют рынок и логично связаны с AnonBase.

---

## Часть 1: Skills — полный обзор по источникам

### 1.1 openclawskills.dev (категории)

| Категория | Skills |
|-----------|--------|
| **Web Automation** | Browser, Web Search (Brave), Web Fetch |
| **Communication** | Message (WhatsApp, Telegram, Discord, Slack, Signal), Slack Notify, Discord Webhook |
| **Development** | GitHub Trending |
| **Finance** | Stock Ticker, Currency Converter |
| **Media & UI** | Canvas, Image Analysis, YouTube Transcription |
| **Network** | Port Scanner, Whois Lookup, IP Info |
| **News & Info** | HackerNews Digest |
| **Productivity** | Notion Page |
| **Runtime & OS** | Exec, Process, Apply Patch |
| **Security** | Password Gen |
| **Utilities** | Weather Check, JSON Validator, Lorem Ipsum, Base64 Encoder, UUID Generator, QR Code Gen |
| **Plugins** | Lobster (workflows), LLM Task |
| **Automation** | Cron, Gateway |

### 1.2 clawskills.site (по популярности)

| Skill | Категория | Описание |
|-------|-----------|----------|
| Gog | Calendar & Scheduling | Google Workspace: Gmail, Calendar, Drive, Contacts, Sheets, Docs |
| self-improving-agent | Productivity | Ошибки и исправления → обучение |
| Tavily Web Search | Search & Research | AI-оптимизированный поиск |
| Agent Browser | Browser & Automation | Headless browser: navigate, click, type, snapshot |
| Summarize | PDF & Documents | URLs, PDFs, images, audio, YouTube |
| Find Skills | Productivity | Поиск skills по запросу |
| Github | Git & GitHub | gh CLI: issues, PRs, runs, api |
| Sonoscli | Productivity | Управление Sonos |
| Weather | Productivity | Погода (без API key) |
| Ontology | PDF & Documents | Knowledge graph, entities |
| ByteRover | Productivity | Project knowledge, context tree |
| Proactive Agent | Productivity | WAL Protocol, Working Buffer, автономность |

### 1.3 awesome-openclaw / GitHub

| Skill/Проект | Описание |
|--------------|----------|
| **BankrBot/openclaw-skills** | DeFi/crypto: Polymarket, token trading, NFTs, on-chain messaging |
| **pumpclaw** | Token launcher для агентов на Base, Uniswap V4 |
| **Unbrowse** | Self-learning API skill — авто-обнаружение API из браузера |
| **Foundry** | Self-writing meta-extension — учится, пишет новые capabilities |
| **ClawSec** | Security suite |
| **ClawBands** | Security middleware, human-in-the-loop |
| **Clawhatch** | Pre-install scanner для skills |
| **QMD Skill** | Снижение token usage на 95% |
| **Supermemory** | Unlimited memory |
| **AfrexAI Skills** | 13 бизнес-skills: prospect research, cold email, competitor analysis, meeting prep, LinkedIn, CRM, invoicing, SEO, daily briefing |
| **Mixpost** | Social media management |
| **Luma Events** | Поиск событий, RSVP, Google Calendar |
| **ClawdTalk** | Телефонные звонки и SMS |
| **BotEmail.ai** | Email inbox для агентов |
| **Cost Governor** | x402 payments, бюджет LLM |
| **You.com** | Search + AI integration |

### 1.4 Virtuals / ACP специфичные

| Skill | Источник | Описание |
|-------|----------|----------|
| **openclaw-acp** | GitHub Virtual-Protocol | ACP: browse, job create, sell, wallet, serve |
| **dgclaw-skill** | GitHub Virtual-Protocol | DegenerateClaw форум: посты, комментарии |
| **virtuals-protocol-acp** | ClawHub (?) | Возможно обёртка ACP |

---

## Часть 2: Связь Skills ↔ Jobs

**Важно:** Jobs выполняются в `handlers.ts` (TypeScript). Skills из ClawHub — для OpenClaw-агента (gateway). В handlers можно вызывать **любые API** и **npm-пакеты** — не обязательно skills.

| Если job нуждается в... | Варианты |
|-------------------------|----------|
| Поиск в интернете | Tavily API, Brave API, fetch — из handlers |
| Браузер (скрапинг) | Agent Browser skill — или puppeteer/playwright в handlers |
| GitHub данные | GitHub API, gh CLI, github skill |
| Крипто/on-chain | BankrBot skills, DEXScreener API, Basescan API |
| Суммаризация | Summarize skill, или LLM API из handlers |
| Память/обучение | self-improving-agent, ByteRover, Ontology, или свой кэш в handlers |
| Workflow | Lobster, Cron |
| Безопасность | ClawSec, ClawBands |
| Соцсети | Mixpost, Message, Discord Webhook, Slack Notify |

**Вывод:** Сначала определяем jobs → потом решаем, что нужно (API vs skill).

---

## Часть 3: Что уже есть на aGDP (из скриншота)

| Offering | Агент | Цена | Суть |
|----------|-------|------|------|
| swap | Ethy AI | $0.50 | Своп токенов на Base |
| Virtuals on-chain off-chain | WhaleIntel | $1.00 | On-chain + off-chain данные |
| trending_tokens | Remi | $0.25 | Топ трендовые токены Base |
| marketIntelligence | Loky | $1.00 | Token analysis, smart money, on-chain |
| indigo | aixbt | $2.00 | Free-text вопросы о токене/проекте/секторе |
| factCheck | ArAIstotle | $0.10 | Проверка утверждений |
| cyber_security_consultant | Cybercentry | $1.00 | Кибербезопасность |
| open_position | — | — | Торговля |
| develop_ui | — | — | Разработка UI |
| proResearch | — | — | Исследования |
| song_guess, musicVideo | — | — | Медиа/игры |

**Занято:** token analysis, trending, swap, fact check, security, trading, research, media.

---

## Часть 4: Альтернативные идеи для Jobs

### Направление A: Агент-агент, не человек-агент

| Идея | Описание | Связь с AnonBase | Конкуренция |
|------|----------|-----------------|-------------|
| **agent_handoff** | Передача контекста/задачи от одного агента другому. «Я не умею X, передаю тебе». | Экосистема агентов | Мало |
| **agent_matchmaker** | «Найди агента для задачи Y» — по описанию задачи подбор подходящего offering. | Intelligence layer | Мало |
| **second_opinion** | Агент просит проверить/верифицировать результат другого агента. | Trust, integrity | Мало |
| **agent_brief** | Краткий отчёт «что умеет агент X» для другого агента или человека. | Обзор экосистемы | Мало |

### Направление B: Данные и мета-уровень

| Идея | Описание | Связь с AnonBase | Конкуренция |
|------|----------|-----------------|-------------|
| **offerings_digest** | Еженедельный/ежедневный дайджест новых offerings на aGDP. | Мониторинг экосистемы | Мало |
| **agent_activity_pulse** | «Кто активен, кто выполняет jobs» — пульс маркетплейса. | Metrics | Мало |
| **cross_agent_summary** | Объединить результаты нескольких агентов в один отчёт. | Оркестрация | Мало |

### Направление C: Trust и проверки (но не как integrity_scan)

| Идея | Описание | Связь с AnonBase | Конкуренция |
|------|----------|-----------------|-------------|
| **offering_verify** | Проверить: offering делает то, что заявлено? (тестовый job + анализ ответа) | Integrity | Мало |
| **agent_reputation_aggregate** | Собрать отзывы/репутацию агента из разных источников. | Trust layer | Мало |

### Направление D: Связь с Base / privacy (мягко)

| Идея | Описание | Связь с AnonBase | Конкуренция |
|------|----------|-----------------|-------------|
| **base_ecosystem_alert** | Алерты: новый крупный агент, новый offering, аномалии. | Base = дом AnonBase | Мало |
| **privacy_readiness_check** | «Готов ли проект к privacy-требованиям?» — чеклист, не реализация. | AnonBase = privacy | Мало |

### Направление E: Креатив / утилиты

| Идея | Описание | Связь с AnonBase | Конкуренция |
|------|----------|-----------------|-------------|
| **agent_pitch_writer** | Написать pitch/описание для offering агента. | Помощь экосистеме | Мало |
| **job_requirements_validator** | Проверить requirements для job — валидны ли, полные ли. | Качество маркетплейса | Мало |

---

## Часть 5: Рекомендуемый процесс выбора

1. **Выбери направление** (A–E или смесь).
2. **Выбери 1–2 конкретных job** для MVP.
3. **Определи requirements** — что на входе.
4. **Определи, что нужно для выполнения:**
   - API (DEXScreener, agdp, GitHub, Tavily)?
   - Skills (Browser, Summarize, GitHub)?
   - Свой код (fetch, логика)?
5. **Подбери skills** под выбранные jobs.

---

## Часть 6: Skills под разные направления

| Если выбрал направление... | Потенциально полезные skills |
|---------------------------|------------------------------|
| **A (agent-agent)** | ACP, Summarize, Find Skills, ByteRover (контекст), Ontology |
| **B (данные, мета)** | ACP, Web Fetch, Web Search, Cron, GitHub Trending |
| **C (trust)** | ACP, Agent Browser, factCheck-подобная логика |
| **D (Base/privacy)** | ACP, Web Fetch, Stock Ticker / crypto API |
| **E (креатив)** | Summarize, LLM Task, ACP |

**Базово всегда:** openclaw-acp (extraDirs).

---

## Следующий шаг

Ответь:
1. Какое направление (A–E) ближе?
2. Есть ли свои идеи jobs, которых тут нет?
3. Хочешь ли комбинировать несколько направлений?

После этого подберём точный набор skills и набросаем requirements для выбранных jobs.
