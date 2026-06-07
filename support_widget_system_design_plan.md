# SupportWidget — учебный system design проект

## Цель проекта

Сделать с нуля production-like проект для прокачки system design навыков за пределами фронтенда.

Проект: **виджет онлайн-чата поддержки для встраивания на сайты**.

Идея: владелец сайта вставляет JS-скрипт, на сайте появляется чат, посетитель пишет в поддержку, оператор отвечает из dashboard.

Пример встраивания:

```html
<script
  src="https://cdn.support-widget.dev/widget.js"
  data-project-id="abc123"
></script>
```

---

## Что нужно прокачать через этот проект

Проект должен закрыть такие темы:

- проектирование backend API;
- схема базы данных;
- PostgreSQL;
- Redis;
- WebSocket/realtime;
- Google OAuth / OpenID Connect;
- авторизация операторов;
- анонимные visitor sessions;
- multi-tenant архитектура;
- балансировщик нагрузки;
- DNS;
- HTTPS;
- CORS;
- Docker;
- Docker Compose;
- Kubernetes;
- CI/CD;
- деплой;
- мониторинг;
- оценка нагрузок и мощностей.

---

## Общая архитектура

```text
Customer website
   |
   | widget.js
   v
Chat Widget  <---- WebSocket ----> Realtime API
                                  |
                                  | Redis Pub/Sub / Streams
                                  |
Operator Dashboard <--- HTTP/WebSocket ---> Backend API
                                  |
                                  | PostgreSQL
                                  |
                              Messages DB
```

Основные части:

```text
1. Widget SDK
   JS-скрипт, который встраивается на сайт клиента.

2. Operator Dashboard
   Админка/панель оператора для службы поддержки.

3. Backend API
   HTTP API для авторизации, организаций, проектов, диалогов, сообщений.

4. Realtime Gateway
   WebSocket-сервер для обмена сообщениями в реальном времени.

5. PostgreSQL
   Основное хранилище данных.

6. Redis
   Pub/Sub, online presence, rate limit, временные состояния.

7. Reverse Proxy / Load Balancer
   Nginx, Caddy или cloud load balancer.

8. CDN / Static Hosting
   Для раздачи widget.js.
```

---

## Рекомендуемый стек

### Frontend

```text
- React / Next.js для operator dashboard
- TypeScript
- Vite / tsup для сборки widget SDK
- Vanilla TS для widget.js, чтобы не тащить тяжёлый runtime
```

### Backend

```text
- Node.js
- TypeScript
- Fastify или NestJS
- ws / Socket.IO / uWebSockets.js для WebSocket
```

### Database

```text
- PostgreSQL как основная база
- Redis для realtime-событий и временных данных
```

### Infra

```text
- Docker Compose на ранних этапах
- Nginx / Caddy как reverse proxy
- GitHub Actions для CI/CD
- Kubernetes позже
- Prometheus / Grafana / Loki позже
```

---

## Структура репозитория

```text
support-widget/
  apps/
    api/
      src/
      Dockerfile
      package.json

    dashboard/
      src/
      Dockerfile
      package.json

    widget-demo-site/
      src/
      package.json

  packages/
    widget-sdk/
      src/
      package.json

    shared/
      src/
      package.json

  infra/
    docker-compose.yml
    nginx/
      nginx.conf

  docs/
    architecture.md
    api.md
    database.md
    deployment.md

  package.json
  pnpm-workspace.yaml
  README.md
```

---

# Версии проекта

---

## v0 — локальный MVP

### Цель

Сделать минимально рабочий чат:

```text
1. Widget открывается на demo-сайте.
2. Пользователь пишет сообщение.
3. Оператор видит сообщение в dashboard.
4. Оператор отвечает.
5. Пользователь видит ответ.
6. Сообщения сохраняются в PostgreSQL.
```

### Можно ли локально?

Да, полностью.

### Деньги

```text
0 €
```

### Компоненты

```text
api
dashboard
widget-sdk
widget-demo-site
postgres
redis
```

### Минимальная БД

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  google_sub TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE visitors (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  external_id TEXT,
  anonymous_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  assigned_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_type TEXT NOT NULL,
  sender_id UUID,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP
);

CREATE TABLE widget_sessions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### Минимальные HTTP endpoints

```text
POST /widget/session
POST /widget/conversations
GET  /widget/conversations/:id/messages
POST /widget/conversations/:id/messages

GET  /operator/conversations
GET  /operator/conversations/:id
POST /operator/conversations/:id/messages
PATCH /operator/conversations/:id
```

### WebSocket events

```text
client -> server:
- visitor:message:create
- operator:message:create
- conversation:join
- conversation:leave
- typing:start
- typing:stop

server -> client:
- message:created
- message:delivered
- message:read
- conversation:updated
- typing:started
- typing:stopped
```

### Что изучить на этом этапе

```text
- basic HTTP API
- WebSocket connection lifecycle
- PostgreSQL schema
- migrations
- Docker Compose
- CORS
- простые visitor sessions
```

---

## v1 — Google Auth и multi-tenant

### Цель

Добавить нормальную авторизацию для операторов и поддержку разных организаций/проектов.

### Можно ли локально?

Да.

### Деньги

```text
0 €
```

Google OAuth можно тестировать на localhost.

### Что добавить

```text
- Google login для операторов
- Organizations
- Projects
- Roles
- Allowed origins
- Public project key
- Operator sessions
```

### Типы пользователей

```text
1. Visitor
   Анонимный посетитель сайта.

2. Operator
   Сотрудник поддержки.

3. Admin
   Управляет проектом, операторами и настройками.

4. Owner
   Владелец организации.
```

### Авторизация

```text
Оператор:
Google login
  -> backend проверяет Google ID token
  -> backend создаёт user session или JWT
  -> dashboard работает от имени user

Посетитель:
widget открывается с public project key
  -> backend создаёт visitor
  -> backend выдаёт visitor session token
  -> visitor общается через WebSocket
```

### Важно

В widget.js нельзя хранить секреты.

Можно хранить:

```text
- project public key
- project id
- allowed origin
```

Нельзя хранить:

```text
- private API key
- OAuth client secret
- database credentials
```

### Что изучить

```text
- OAuth
- OpenID Connect
- JWT vs cookie session
- roles
- multi-tenant data model
- CORS / allowed origins
```

---

## v2 — масштабирование realtime

### Цель

Понять, что происходит, когда backend-инстансов становится несколько.

### Можно ли локально?

Да.

### Деньги

```text
0 €
```

### Локальная схема

```text
nginx
  -> api-1
  -> api-2
  -> api-3

redis
postgres
```

### Проблема

```text
Visitor подключился к api-1
Operator подключился к api-2

Visitor отправил сообщение.
Как api-2 узнает об этом сообщении?
```

### Решение

Использовать Redis Pub/Sub или Redis Streams.

```text
api-1 получает сообщение
api-1 сохраняет сообщение в PostgreSQL
api-1 публикует событие в Redis
api-2 получает событие из Redis
api-2 отправляет событие operator dashboard
```

### Что добавить

```text
- Redis Pub/Sub
- несколько backend containers
- Nginx load balancing
- healthcheck endpoint
- graceful shutdown
- reconnect logic
- message acknowledgement
```

### Что изучить

```text
- stateful WebSocket connections
- stateless HTTP API
- shared event bus
- load balancing
- sticky sessions
- horizontal scaling
```

---

## v3 — публичное демо

### Цель

Сделать проект доступным извне.

### Можно ли локально?

Частично.

Если нужно только тестировать самому — можно локально.

Если нужно показать проект другому человеку — нужен публичный URL.

### Вариант A — tunnel

```text
ngrok
Cloudflare Tunnel
```

Цена:

```text
0 €
```

Плюсы:

```text
- быстро
- не надо покупать сервер
- подходит для демо
```

Минусы:

```text
- не production
- URL может быть временным
- есть лимиты
```

### Вариант B — free hosting

```text
Render
Railway
Fly.io free/cheap tier
```

Цена:

```text
0–8 €/мес
```

Минусы бесплатных вариантов:

```text
- cold start
- ограничения по WebSocket
- ограничения по базе
- нестабильно для long-running connections
```

### Что изучить

```text
- публичный backend
- HTTPS
- environment variables
- CORS на реальных доменах
- WebSocket через HTTPS/WSS
```

---

## v4 — домен, DNS, CDN

### Цель

Сделать настоящую доменную структуру.

### Деньги

```text
Домен: 10–25 €/год
DNS через Cloudflare: 0 €
SSL: 0 €
```

### Пример DNS-структуры

```text
support-widget.dev              -> landing/admin
app.support-widget.dev          -> dashboard
api.support-widget.dev          -> HTTP API
ws.support-widget.dev           -> WebSocket endpoint
cdn.support-widget.dev          -> widget.js
```

### DNS-записи

```text
A record:
api.support-widget.dev -> IP load balancer / VPS

AAAA record:
api.support-widget.dev -> IPv6 load balancer / VPS

CNAME:
cdn.support-widget.dev -> CDN provider domain
```

### Где хранить widget.js

Сначала можно просто отдавать с backend/nginx:

```text
https://cdn.support-widget.dev/widget.js
```

Позже можно вынести в CDN/static hosting:

```text
Cloudflare Pages
Vercel
Netlify
S3-compatible storage
```

### Что изучить

```text
- A record
- AAAA record
- CNAME
- DNS propagation
- HTTPS certificates
- CDN
- cache-control
- versioning widget.js
```

---

## v5 — один VPS как почти production

### Цель

Развернуть всё на одном сервере и получить настоящий deploy.

### Рекомендуемый бюджет

```text
VPS: 5–10 €/мес
Домен: 10–25 €/год
Cloudflare DNS/SSL: 0 €
```

### Схема

```text
VPS
  |
  |-- Nginx / Caddy
  |-- api
  |-- dashboard static build
  |-- widget.js static file
  |-- PostgreSQL
  |-- Redis
```

### Docker Compose на сервере

```text
nginx
api
dashboard
postgres
redis
```

### Что изучить

```text
- SSH
- Linux server basics
- firewall
- Docker Compose на сервере
- reverse proxy
- HTTPS
- env variables
- logs
- backups
- deploy script
- database migrations
```

### Почему это хороший этап

Это лучший баланс для обучения:

```text
- стоит недорого
- инфраструктура настоящая
- ты руками трогаешь production-похожие проблемы
- не нужно сразу уходить в сложное облако
```

---

## v6 — managed services

### Цель

Разнести сервисы так, как это часто делают в production.

### Схема

```text
Frontend/dashboard: Vercel / Netlify / Cloudflare Pages
Backend: VPS / Fly.io / Render
PostgreSQL: Neon / Supabase / managed Postgres
Redis: Upstash / managed Redis
Storage: Cloudflare R2 / S3
```

### Бюджет

```text
0–30 €/мес для pet project
10–50+ €/мес для production-like setup
```

### Что вынести

```text
PostgreSQL -> managed database
Redis -> managed Redis
Attachments -> object storage
Dashboard -> static hosting
widget.js -> CDN
```

### Что изучить

```text
- managed Postgres
- connection pooling
- database migrations в production
- managed Redis
- object storage
- signed upload URLs
- secrets management
- billing awareness
```

---

## v7 — Kubernetes

### Цель

Перенести backend и инфраструктуру в Kubernetes.

### Важно

Не начинать с Kubernetes.

Сначала:

```text
localhost
-> Docker Compose
-> VPS
-> несколько backend-инстансов
-> managed DB/Redis
-> Kubernetes
```

### Локальный Kubernetes

Можно бесплатно:

```text
kind
minikube
Docker Desktop Kubernetes
```

Цена:

```text
0 €
```

### Kubernetes на одном VPS

Можно поставить:

```text
k3s
```

Цена:

```text
5–15 €/мес
```

### Managed Kubernetes

Цена:

```text
20–100+ €/мес
```

### Kubernetes объекты

```text
Deployment для backend
Service для backend
Ingress / Gateway для внешнего доступа
ConfigMap для конфигов
Secret для секретов
HorizontalPodAutoscaler
readinessProbe
livenessProbe
```

### Что изучить

```text
- Pods
- Deployments
- Services
- Ingress
- Gateway API
- ConfigMap
- Secret
- rolling updates
- readiness/liveness probes
- autoscaling
- observability
```

---

# Бюджет по этапам

| Версия | Что делаешь | Можно локально? | Деньги |
|---|---:|---:|---:|
| v0 | MVP: widget, dashboard, API, WebSocket, PostgreSQL, Redis | Да | 0 € |
| v1 | Google auth, organizations/projects, роли | Да | 0 € |
| v2 | Несколько backend-инстансов, Redis Pub/Sub, Nginx load balancing | Да | 0 € |
| v3 | Публичное демо с HTTPS | Частично | 0–10 €/мес |
| v4 | Домен, DNS, CDN для widget.js | Нет, если нужен настоящий домен | 10–25 €/год |
| v5 | Production-like VPS | Нет | 5–15 €/мес |
| v6 | Managed DB/Redis/observability | Нет | 10–50+ €/мес |
| v7 | Kubernetes | Локально — да, облако — платно | 0 локально / 20–100+ €/мес |

---

# Минимальный бюджет

```text
v0–v2: 0 €
v3: 0 €, через tunnel/free hosting
v4: домен 10–25 €/год
```

Первые недели или месяц можно вообще не платить.

---

# Оптимальный бюджет для обучения

```text
Домен: 10–25 €/год
VPS: 5–10 €/мес
Cloudflare: 0 €
Postgres/Redis на VPS: 0 €
```

Итого:

```text
5–10 €/мес + домен
```

Это лучший вариант, потому что ты изучаешь реальный деплой, но не уходишь в большие облачные расходы.

---

# Production-like pet project бюджет

```text
Backend: 5–15 €/мес
Managed Postgres: 0–15 €/мес
Managed Redis: 0–10 €/мес
Frontend/CDN: 0 €
Domain: 10–25 €/год
```

Итого:

```text
10–40 €/мес
```

---

# Когда точно не нужен хостинг

Хостинг не нужен, чтобы изучить:

```text
- написать код
- проверить WebSocket
- проверить Redis Pub/Sub
- проверить несколько backend-инстансов
- проверить балансировщик
- проверить Google auth на localhost
- проверить Docker Compose
- проверить Kubernetes локально
```

---

# Когда хостинг понадобится

Хостинг понадобится или будет очень желателен для:

```text
- публичного демо
- настоящего HTTPS-домена
- проверки CORS/allowed origins на реальном сайте
- проверки embed-скрипта на внешнем домене
- стабильного WebSocket endpoint
- production-like DNS
- настоящего deploy pipeline
```

---

# Первый практический шаг

Не начинать с Kubernetes и не пытаться сразу сделать идеальную архитектуру.

Первый шаг:

```text
1. Создать monorepo.
2. Поднять PostgreSQL и Redis через Docker Compose.
3. Сделать backend на Node.js + TypeScript.
4. Создать таблицы organizations, projects, visitors, conversations, messages.
5. Сделать endpoint POST /widget/session.
6. Сделать endpoint POST /widget/conversations.
7. Сделать WebSocket endpoint /ws.
8. Сделать простейший widget.js.
9. Сделать dashboard, который видит сообщения.
10. Проверить полный цикл: visitor пишет -> operator видит -> operator отвечает.
```

---

# Что должно получиться после v0

```text
Локально работает система:

- demo-сайт подключает widget.js;
- виджет открывается;
- visitor может написать сообщение;
- backend принимает сообщение;
- сообщение сохраняется в PostgreSQL;
- operator dashboard получает сообщение через WebSocket;
- оператор отвечает;
- visitor видит ответ.
```

---

# Главная идея проекта

Этот проект нужен не для того, чтобы сделать очередной чат.

Он нужен, чтобы научиться объяснять эволюцию архитектуры:

```text
localhost
  -> Docker Compose
  -> VPS
  -> несколько backend-инстансов
  -> Redis event bus
  -> managed DB/Redis
  -> CDN
  -> Kubernetes
```

И на system design собеседовании уметь спокойно объяснить:

```text
- какие сервисы нужны;
- какие таблицы нужны;
- как работает auth;
- почему WebSocket;
- как масштабировать WebSocket;
- зачем Redis;
- как работает load balancer;
- какие DNS records нужны;
- где хранить widget.js;
- какие мощности нужны;
- когда нужен VPS;
- когда нужны managed services;
- когда нужен Kubernetes.
```

---

# Рекомендуемый порядок работы

```text
1. v0: локальный MVP
2. v1: Google auth и multi-tenant
3. v2: несколько backend-инстансов + Redis Pub/Sub
4. v3: публичное демо
5. v4: домен + DNS + CDN
6. v5: VPS + Docker Compose production-like deploy
7. v6: managed DB/Redis/storage
8. v7: Kubernetes
```

---

# Критерий успеха

Проект успешен, если после него ты можешь не просто сказать:

```text
"Я сделал чат"
```

А можешь объяснить:

```text
"Я понимаю, как спроектировать встраиваемый realtime-виджет поддержки:
от frontend SDK и auth до базы, WebSocket, Redis, балансировки, DNS, деплоя и Kubernetes".
```
