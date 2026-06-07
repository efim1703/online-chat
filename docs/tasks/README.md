# Задачи проекта SupportWidget

Полный план эволюции архитектуры — в [support_widget_system_design_plan.md](../../support_widget_system_design_plan.md).
Здесь — разбивка по версиям на конкретные подзадачи с чекбоксами.

## Как это устроено

- Один файл на версию: `vN-*.md`.
- Каждая задача имеет ID вида `vN-<шаг>.<подзадача>` (например `v0-4.2`) — на него удобно ссылаться в коммитах.
- Прогресс отмечается чекбоксами `- [ ]` / `- [x]`.
- Делаем строго по версиям v0 → v7, не убегая вперёд (см. CLAUDE.md).

## Роадмап

| Версия | Описание | Статус |
|---|---|---|
| [v0](v0-mvp.md) | Локальный MVP: widget → API → WebSocket → Postgres → dashboard | 🚧 В работе |
| v1 | Google Auth + multi-tenant (организации, проекты, роли) | ⬜ Не начато |
| v2 | Несколько инстансов API + Redis Pub/Sub + Nginx LB | ⬜ Не начато |
| v3 | Публичное демо (HTTPS, tunnel/free hosting) | ⬜ Не начато |
| v4 | Домен, DNS, CDN для widget.js | ⬜ Не начато |
| v5 | Production-like VPS + Docker Compose deploy | ⬜ Не начато |
| v6 | Managed DB/Redis/storage | ⬜ Не начато |
| v7 | Kubernetes | ⬜ Не начато |

Легенда статусов: ⬜ не начато · 🚧 в работе · ✅ готово
