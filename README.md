# SupportWidget

Учебный system design проект: встраиваемый виджет онлайн-чата поддержки.

Полный план эволюции архитектуры (v0→v7) — в [support_widget_system_design_plan.md](support_widget_system_design_plan.md).

## Документация

Документация устроена в три уровня — от общей стратегии к конкретным задачам:

| Уровень | Файл | Назначение |
|---|---|---|
| 1. Общий план | [support_widget_system_design_plan.md](support_widget_system_design_plan.md) | Эволюция архитектуры v0→v7 — «что и почему» на верхнем уровне |
| 2. План версии | `docs/vN-implementation-plan.md` ([v0](docs/v0-implementation-plan.md)) | Подробный план реализации версии: контекст, обоснования, пути файлов, verification |
| 3. Задачи | `docs/tasks/vN-*.md` ([v0](docs/tasks/v0-mvp.md)) | Конкретные задачи с ID-чекбоксами (`vN-<шаг>.<подзадача>`) для агента |

Роадмап со статусами всех версий — в [docs/tasks/README.md](docs/tasks/README.md).

**Поток работы:** тему фиксируем в общем плане → доходя до версии, разворачиваем её
в план реализации `docs/vN-implementation-plan.md` и задачи `docs/tasks/vN-*.md`.
Планы реализации и задачи создаются по мере продвижения, поэтому файлы есть только
для версии в работе и завершённых.

Инструкции для AI-агентов — в [AGENTS.md](AGENTS.md) (`CLAUDE.md` — симлинк на него).

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
docs/                 # планы реализации версий + задачи (см. раздел «Документация»)
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
