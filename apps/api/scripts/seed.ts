// reflect-metadata должен загружаться до любого декорированного класса, как и в main.ts —
// DI-контейнер Nest читает метаданные, которые TypeScript эмитирует для провайдеров.
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
// NodeNext ESM-резолюция требует расширение .js даже для .ts-источника (tsx его маппит).
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';

/**
 * Локальный сид для v0 (авторизации ещё нет — она появится в v1).
 *
 * Вставляет минимально необходимые для ручного e2e-цикла данные:
 *   - одну организацию
 *   - один проект с ИЗВЕСТНЫМ public_key + origin демо-сайта в allowed_origins,
 *     чтобы widget-demo-site мог захардкодить его как data-project-id и пройти CORS
 *   - одного оператора
 *
 * Посетители / диалоги / сообщения / widget_sessions создаются в рантайме
 * через API (задачи v0-4.6..4.8) и намеренно НЕ сидируются здесь.
 *
 * Идемпотентен: фиксированные UUID + ON CONFLICT гарантируют, что `pnpm seed`
 * можно запускать любое число раз без дублей и нарушений UNIQUE.
 */

// Фиксированные идентификаторы делают сид идемпотентным и позволяют другим
// пакетам ссылаться на стабильные значения во время локальной разработки.
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const PROJECT_ID = '00000000-0000-0000-0000-000000000002';
const OPERATOR_ID = '00000000-0000-0000-0000-000000000003';

// Известный публичный ключ, который виджет встраивает как data-project-id (см. widget-demo-site, v0-6.1).
const PROJECT_PUBLIC_KEY = 'pk_demo_local';
// Origin виджет-демо-сайта (Vite :5173). Дашборд работает на :5174 (CORS оператора).
const DEMO_ORIGIN = 'http://localhost:5173';

async function seed(): Promise<void> {
  // Standalone-контекст Nest (без HTTP-сервера) — переиспользует ConfigModule (.env) и
  // пул DatabaseService ровно так же, как работающее приложение.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const db = app.get(DatabaseService);

  try {
    // Организация. ON CONFLICT (id) DO NOTHING: повторный запуск сохраняет существующую строку.
    await db.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'Acme Inc'],
    );

    // Проект. DO UPDATE позволяет обновить origin / public_key при повторном сиде
    // (например, если демо-сайт переехал на другой порт) без ручного редактирования.
    await db.query(
      `INSERT INTO projects (id, organization_id, name, public_key, allowed_origins)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET public_key      = EXCLUDED.public_key,
             allowed_origins = EXCLUDED.allowed_origins`,
      [PROJECT_ID, ORG_ID, 'Acme Website', PROJECT_PUBLIC_KEY, [DEMO_ORIGIN]],
    );

    // Пользователь-оператор. Настоящая авторизация (Google) — в v1; здесь нужна лишь строка с role='operator'.
    await db.query(
      `INSERT INTO users (id, organization_id, email, name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [OPERATOR_ID, ORG_ID, 'operator@demo.local', 'Demo Operator', 'operator'],
    );

    // eslint-disable-next-line no-console -- сид — CLI-скрипт, console здесь и есть UI
    console.log(
      `Seed OK\n` +
        `  organization : ${ORG_ID} (Acme Inc)\n` +
        `  project      : ${PROJECT_ID} public_key=${PROJECT_PUBLIC_KEY}\n` +
        `                 allowed_origins=[${DEMO_ORIGIN}]\n` +
        `  operator     : ${OPERATOR_ID} (operator@demo.local)`,
    );
  } finally {
    // Закрытие контекста завершает пул, и процесс выходит корректно.
    await app.close();
  }
}

seed().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- вывести ошибку в CLI
  console.error('Seed failed:', err);
  process.exit(1);
});
