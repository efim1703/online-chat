# v0 — Локальный MVP

> Цель: полный рабочий цикл локально, без облака и без авторизации (auth = v1).
> Подробный план «почему и как» (контекст, обоснования, пути файлов, verification): [v0-implementation-plan.md](../v0-implementation-plan.md).
> Общий план v0→v7: [support_widget_system_design_plan.md](../../support_widget_system_design_plan.md).

**Definition of Done:** цикл «visitor пишет → operator видит → operator отвечает → visitor видит»
работает локально; сообщения персистятся в PostgreSQL; realtime идёт через нативный WebSocket.

**Стек (зафиксирован):** pnpm workspaces · NestJS · нативный `ws` (`WsAdapter` из `@nestjs/platform-ws`) ·
`pg` + сырые SQL-миграции (`node-pg-migrate`) · Vite + React (dashboard) · vanilla TS + tsup (widget-sdk) ·
Docker Compose (Postgres + Redis).

---

## Шаг 1. Привести каркас в порядок

- [x] `v0-1.1` — Поправить `README.md` и `CLAUDE.md`: бэкенд Fastify → **NestJS**.
- [x] `v0-1.2` — Корневой `package.json`: скрипты-агрегаторы `dev` / `build` / `migrate` / `seed` через `pnpm -r` / фильтры.
- [x] `v0-1.3` — `git init` (репозиторий уже инициализирован).

## Шаг 2. Инфраструктура — `infra/docker-compose.yml`

- [x] `v0-2.1` — Сервис `postgres` (postgres:16): env (user/pass/db), том `pgdata`, проброс `5432`, healthcheck.
- [x] `v0-2.2` — Сервис `redis` (redis:7): проброс `6379`, healthcheck. (в v0 не подключаем в коде — задел на v2).
- [x] `v0-2.3` — `.env.example` в корне: `DATABASE_URL`, `REDIS_URL`, порты.

## Шаг 3. `packages/shared` — общие типы

- [x] `v0-3.1` — `package.json` + `tsconfig` + сборка (tsup или tsc), экспорт типов для остальных пакетов.
- [x] `v0-3.2` — Enum-ы и DTO: `SenderType`, `ConversationStatus`, DTO сообщений и диалогов.
- [x] `v0-3.3` — Контракт WebSocket-событий (имена + payload-типы), единый источник правды:
  - client→server: `visitor:message:create`, `operator:message:create`, `conversation:join`, `conversation:leave`, `typing:start`, `typing:stop`
  - server→client: `message:created`, `message:delivered`, `message:read`, `conversation:updated`, `typing:started`, `typing:stopped`

## Шаг 4. `apps/api` — NestJS

### БД и миграции
- [x] `v0-4.1` — Bootstrap NestJS: `package.json`, `tsconfig`, структура, `main.ts`.
- [x] `v0-4.2` — `DatabaseModule`: провайдер `pg.Pool` (singleton) из `DATABASE_URL`.
- [ ] `v0-4.3` — Настройка `node-pg-migrate` (конфиг + npm-скрипты миграций).
- [ ] `v0-4.4` — SQL-миграция: 7 таблиц **точно по DDL** дизайн-документа (`organizations`, `projects`, `users`, `visitors`, `conversations`, `messages`, `widget_sessions`).
- [ ] `v0-4.5` — Seed-скрипт: одна организация, один проект (известный `public_key`, `allowed_origins` = origin demo-сайта), один оператор (`role='operator'`).

### HTTP endpoints
- [ ] `v0-4.6` — `POST /widget/session` — по `public_key` создать/найти visitor, выдать session token (хеш в `widget_sessions`).
- [ ] `v0-4.7` — Widget conversations: `POST /widget/conversations`, `GET /widget/conversations/:id/messages`, `POST /widget/conversations/:id/messages`.
- [ ] `v0-4.8` — Operator: `GET /operator/conversations`, `GET /operator/conversations/:id`, `POST /operator/conversations/:id/messages`, `PATCH /operator/conversations/:id` (status/assign).
- [ ] `v0-4.9` — Dev-guard для operator-роутов (токен из seed; настоящий auth = v1).
- [ ] `v0-4.10` — Глобальный `ValidationPipe` + DTO (class-validator); CORS (widget по `allowed_origins`, operator по origin dashboard); `GET /health`.

### WebSocket (нативный ws)
- [ ] `v0-4.11` — `main.ts`: `app.useWebSocketAdapter(new WsAdapter(app))` (`@nestjs/platform-ws`).
- [ ] `v0-4.12` — `RealtimeGateway`: авторизация по токену в query; in-process registry соединений по `conversationId`; `conversation:join`/`leave`.
- [ ] `v0-4.13` — `MessagesService` (единый для HTTP и WS): «сохранить в PG → разослать `message:created` в комнату».
- [ ] `v0-4.14` — Typing-события: трансляция в комнату без записи в БД.

## Шаг 5. `packages/widget-sdk` — `widget.js`

- [ ] `v0-5.1` — `package.json` + конфиг tsup (один бандл, без тяжёлого runtime).
- [ ] `v0-5.2` — Чтение `data-project-id` / public key из `<script>`-тега; конфиг API/WS URL.
- [ ] `v0-5.3` — Поток: `POST /widget/session` → token → WS (`?token=`) → `conversation:join`.
- [ ] `v0-5.4` — UI: плавающая кнопка + панель чата, изоляция стилей через Shadow DOM.
- [ ] `v0-5.5` — Отправка/приём сообщений в UI (рендер `message:created`).

## Шаг 6. `apps/widget-demo-site`

- [ ] `v0-6.1` — Статический `index.html`, подключает собранный `widget.js` с `data-project-id` из seed (тест CORS/embed).

## Шаг 7. `apps/dashboard` — Vite + React

- [ ] `v0-7.1` — Scaffold Vite + React, `package.json`.
- [ ] `v0-7.2` — Список диалогов (`GET /operator/conversations`).
- [ ] `v0-7.3` — Открытие диалога + история сообщений.
- [ ] `v0-7.4` — WS оператора: приём `message:created` / `conversation:updated`, отправка ответов.
- [ ] `v0-7.5` — Dev-токен оператора из seed (без логина — это v0).

## Шаг 8. Verification (end-to-end)

- [ ] `v0-8.1` — `docker compose up -d` → `pnpm install` → `pnpm migrate` → `pnpm seed`.
- [ ] `v0-8.2` — Собрать widget-sdk; запустить api + dashboard + demo-site.
- [ ] `v0-8.3` — E2E прогон: visitor пишет → строка в `messages` (проверить запросом) → dashboard получает по WS → оператор отвечает → ответ в виджете. (вручную или Playwright MCP).
- [ ] `v0-8.4` — Проверить CORS: чужой origin к widget-роутам отклоняется, allowed origin — проходит.
