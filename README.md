# SupportWidget

Учебный system design проект: встраиваемый виджет онлайн-чата поддержки.

Полный план эволюции архитектуры (v0→v7) — в [support_widget_system_design_plan.md](support_widget_system_design_plan.md).

## Структура

```
apps/
  api/                # Backend HTTP + WebSocket API (Node + TS + NestJS)
  dashboard/          # Operator dashboard (React)
  widget-demo-site/   # Демо-сайт для проверки встраивания widget.js
packages/
  widget-sdk/         # JS-скрипт виджета (vanilla TS, собирается в widget.js)
  shared/             # Общие типы (WebSocket-события, DTO)
infra/
  docker-compose.yml  # Postgres + Redis для локальной разработки
docs/                 # architecture / api / database / deployment
```

## Требования

- Node 22+
- pnpm 10+
- Docker (для Postgres + Redis)

## Быстрый старт

```bash
pnpm install
pnpm infra:up        # поднять Postgres + Redis
```

## Статус

**v0 — локальный MVP.** В работе.
