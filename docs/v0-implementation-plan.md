# План реализации: SupportWidget v0 — локальный MVP

> Подробный план «почему и как». Краткий чеклист задач с ID — в [tasks/v0-mvp.md](tasks/v0-mvp.md).
> Общий план эволюции архитектуры v0→v7 — в [../support_widget_system_design_plan.md](../support_widget_system_design_plan.md).

## Context

Проект — учебный system-design pet-project: встраиваемый виджет онлайн-чата поддержки.
Цель v0 — реализовать **полный рабочий цикл локально**, без облака и без авторизации
(Google auth и multi-tenant — это v1):

1. demo-сайт подключает `widget.js`;
2. посетитель пишет сообщение в виджете;
3. backend принимает, сохраняет в PostgreSQL и рассылает через WebSocket;
4. оператор видит сообщение в dashboard в реальном времени;
5. оператор отвечает → посетитель видит ответ.

### Зафиксированные решения по стеку

- Монорепо на **pnpm workspaces** (Node 22, pnpm 10).
- Backend: **NestJS** + TypeScript.
- Realtime: **нативный `ws`** через `WsAdapter` из `@nestjs/platform-ws` (протокол сообщений — JSON `{ event, data }`).
- БД: **`pg` (node-postgres) + сырые SQL-миграции** через `node-pg-migrate`.
- Dashboard: **Vite + React**.
- Widget SDK: **vanilla TS**, сборка через **tsup** в один `widget.js`.
- Инфра: **Docker Compose** (PostgreSQL + Redis).

> Про Redis: в v0 фанаут сообщений делаем **in-process** (один инстанс API). Redis поднимаем в compose
> заранее для совместимости, но pub/sub между инстансами — это v2. В v0 Redis в коде по сути не используется.

### Режим работы (из CLAUDE.md — обязателен)

Это **парное программирование**, цель — понимание, не скорость:

- **Архитектурные решения** (схема БД, контракты API, WS-события, выбор технологий) — через обсуждение,
  2-3 варианта с trade-offs, выбирает пользователь.
- **Концептуально новое пишет пользователь сам.** Первый контакт с технологией (WS-хендлер, SQL-миграция,
  позже OAuth, Redis Pub/Sub): агент объясняет концепцию + даёт каркас/псевдокод, **финальную логику пишет
  пользователь**, агент ревьюит.
- **Рутину пишет агент:** boilerplate, конфиги, типы, Dockerfile, package.json.
- **Всегда объяснять «почему»**, а не только «что», с альтернативой.
- **Не убегать вперёд по версиям.** Только v0, без фич из v1+.

Распределение по v0 (кто пишет ведущим):
- Агент: каркас монорепо, docker-compose, package.json пакетов, tsconfig, NestJS-bootstrap, DTO/типы в shared, UI dashboard и widget (вёрстка/рутина).
- Пользователь (агент даёт каркас + объясняет): SQL-миграции (схема), `RealtimeGateway` (WS lifecycle), `MessagesService` (persist→broadcast), visitor-session логика.

---

## Структура репозитория (целевая)

```text
support-widget/
  apps/
    api/                  # NestJS: HTTP API + WebSocket gateway
    dashboard/            # Vite + React (панель оператора)
    widget-demo-site/     # статический demo-сайт, подключает widget.js
  packages/
    widget-sdk/           # vanilla TS -> widget.js (tsup)
    shared/               # общие TS-типы (WS-события, DTO, enum-ы)
  infra/
    docker-compose.yml    # postgres + redis
  docs/                   # этот план + задачи + (позже) architecture/api/database
  package.json            # корневой, workspace scripts
  pnpm-workspace.yaml
```

---

## Шаги реализации

### 1. Привести каркас в порядок
- Каркас монорепо уже есть — **не пересоздавать**.
- Поправить `README.md` и `CLAUDE.md`: Fastify → **NestJS**.
- Корневой `package.json`: скрипты-агрегаторы (`dev`, `build`, `migrate`, `seed`) через `pnpm -r` / фильтры.
- `git init`.

### 2. Инфраструктура — `infra/docker-compose.yml`
- `postgres` (postgres:16): env (user/pass/db), том для данных, проброс `5432`, healthcheck.
- `redis` (redis:7): проброс `6379`, healthcheck.
- `.env.example` в корне: `DATABASE_URL`, `REDIS_URL`, порты.

### 3. `packages/shared` — общие типы
- Типы и enum-ы: `SenderType`, `ConversationStatus`, DTO сообщений/диалогов.
- **Контракт WebSocket-событий** (имена + payload), один источник правды для api / dashboard / widget-sdk:
  - client→server: `visitor:message:create`, `operator:message:create`, `conversation:join`, `conversation:leave`, `typing:start`, `typing:stop`
  - server→client: `message:created`, `message:delivered`, `message:read`, `conversation:updated`, `typing:started`, `typing:stopped`
- Сборка через tsup/tsc, экспорт типов остальным пакетам.
- **Почему отдельный пакет:** api, dashboard и widget говорят по одному протоколу — общий пакет не даёт им разойтись.

### 4. `apps/api` — NestJS

**Подключение БД и миграции**
- `DatabaseModule`: провайдер `pg.Pool` (singleton), конфиг из `DATABASE_URL`.
- `node-pg-migrate`: SQL-миграция с 7 таблицами **точно по DDL дизайн-документа** (раздел «Минимальная БД»):
  `organizations`, `projects`, `users`, `visitors`, `conversations`, `messages`, `widget_sessions`.
- Скрипт `seed`: одна организация, один проект с известным `public_key` и `allowed_origins`
  (origin demo-сайта), один оператор (`role='operator'`). Нужен для локального теста без auth.
- **Почему сырой SQL, не ORM:** прямая цель проекта — прокачать PostgreSQL и миграции, поэтому держим контакт с настоящим SQL.

**HTTP endpoints**
- Widget (публичные, CORS по `projects.allowed_origins`):
  - `POST /widget/session` — по `public_key` создаёт/находит visitor, выдаёт visitor session token (хеш в `widget_sessions`).
  - `POST /widget/conversations` — создать диалог для visitor.
  - `GET /widget/conversations/:id/messages` — история.
  - `POST /widget/conversations/:id/messages` — отправить сообщение.
- Operator (в v0 **без реальной auth** — простой dev-guard по токену из seed; Google auth = v1):
  - `GET /operator/conversations`, `GET /operator/conversations/:id`,
    `POST /operator/conversations/:id/messages`, `PATCH /operator/conversations/:id` (status/assign).
- Глобальный `ValidationPipe`, DTO с class-validator.
- CORS: widget-роуты пускают origin-ы проекта, operator-роуты — origin dashboard.
- `GET /health` (пригодится в v2; дёшево добавить сразу).

**WebSocket (нативный ws)**
- `main.ts`: `app.useWebSocketAdapter(new WsAdapter(app))` (`@nestjs/platform-ws`).
- `RealtimeGateway` (`@WebSocketGateway`): авторизация по токену в query (visitor session token / operator dev token).
- In-process registry соединений по `conversationId` (Map conversationId → Set<WebSocket>); обработка `conversation:join/leave`.
- **Единый `MessagesService`**: используется и HTTP-контроллерами, и gateway → логика «сохранить в PG → разослать `message:created` в комнату» не дублируется.
- Typing-события транслируются в комнату без записи в БД.
- **Почему нативный ws, а не Socket.IO:** меньше абстракций, явный lifecycle — это и есть то, что хотим понять для масштабирования realtime в v2.

### 5. `packages/widget-sdk` — `widget.js`
- Vanilla TS, сборка `tsup` в один бандл без тяжёлого runtime.
- Читает `data-project-id` / public key из `<script>`-тега.
- Поток: `POST /widget/session` → visitor token → открыть WS (`?token=`) → `conversation:join` → отправка/приём сообщений.
- Минимальный UI: плавающая кнопка + панель чата, изоляция стилей через **Shadow DOM** (чтобы стили сайта-клиента не ломали виджет и наоборот).

### 6. `apps/widget-demo-site`
- Статический `index.html` (можно Vite vanilla), подключает собранный `widget.js` с `data-project-id` из seed.
  Это «сайт клиента» для проверки CORS/embed.

### 7. `apps/dashboard` — Vite + React
- Список диалогов (`GET /operator/conversations`), открытие диалога, история сообщений.
- WS-подключение оператора: realtime-приём `message:created` / `conversation:updated`, отправка ответов.
- Минимальная вёрстка, dev-токен оператора из seed (без логина — это v0).

---

## Ключевые файлы

- `pnpm-workspace.yaml`, корневой `package.json`, `infra/docker-compose.yml`, `.env.example`
- `apps/api/src/main.ts` (WsAdapter), `apps/api/src/database/database.module.ts`
- `apps/api/migrations/*.sql` (схема по DDL документа), `apps/api/scripts/seed.ts`
- `apps/api/src/widget/*`, `apps/api/src/operator/*`, `apps/api/src/realtime/realtime.gateway.ts`,
  `apps/api/src/messages/messages.service.ts`
- `packages/shared/src/events.ts`, `packages/shared/src/dto.ts`
- `packages/widget-sdk/src/index.ts`, `apps/widget-demo-site/index.html`
- `apps/dashboard/src/App.tsx` + компоненты диалогов/сообщений

DDL и контракты эндпоинтов/событий заданы в [../support_widget_system_design_plan.md](../support_widget_system_design_plan.md)
(разделы «Минимальная БД», «Минимальные HTTP endpoints», «WebSocket events») — следуем им как спецификацией.

---

## Verification (end-to-end локально)

1. `docker compose -f infra/docker-compose.yml up -d` — поднять postgres + redis.
2. `pnpm install` в корне.
3. `pnpm migrate` → таблицы созданы; `pnpm seed` → организация/проект/оператор.
4. `pnpm --filter widget-sdk build` → собрать `widget.js`.
5. Запустить параллельно: `pnpm --filter api dev`, `pnpm --filter dashboard dev`, demo-site.
6. **Прогон полного цикла (вручную или Playwright MCP):**
   - открыть demo-сайт → виджет появляется, открывается;
   - посетитель пишет сообщение → в БД появляется строка в `messages`;
   - в dashboard сообщение приходит по WebSocket без перезагрузки;
   - оператор отвечает → ответ приходит в виджет в реальном времени.
7. Проверить CORS: запрос с чужого origin к widget-роутам отклоняется, с allowed origin — проходит.

### Definition of Done (v0)
Полный цикл «visitor пишет → operator видит → operator отвечает → visitor видит» работает локально,
сообщения персистятся в PostgreSQL, realtime идёт через нативный WebSocket.

---

## Вне области v0 (следующие версии)
Google OAuth / multi-tenant роли (v1), Redis Pub/Sub + несколько инстансов + Nginx LB (v2),
публичное демо / HTTPS (v3+).
