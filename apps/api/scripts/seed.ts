// reflect-metadata must load before any decorated class, same as in main.ts —
// the Nest DI container reads the metadata TypeScript emits for the providers.
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
// NodeNext ESM resolution wants the .js extension even from a .ts source (tsx maps it).
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';

/**
 * Local-only seed for v0 (no auth yet — auth lands in v1).
 *
 * Inserts the minimum the manual e2e loop needs:
 *   - one organization
 *   - one project with a KNOWN public_key + the demo-site origin in allowed_origins,
 *     so widget-demo-site can hardcode it as data-project-id and pass CORS
 *   - one operator user
 *
 * Visitors / conversations / messages / widget_sessions are created at runtime
 * by the API (tasks v0-4.6..4.8), so they are deliberately NOT seeded here.
 *
 * Idempotent: fixed UUIDs + ON CONFLICT mean `pnpm seed` can run any number of
 * times without duplicates or UNIQUE violations.
 */

// Fixed identifiers keep the seed idempotent and let other packages reference
// stable values during local development.
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const PROJECT_ID = '00000000-0000-0000-0000-000000000002';
const OPERATOR_ID = '00000000-0000-0000-0000-000000000003';

// Known public key the widget embeds as data-project-id (see widget-demo-site, v0-6.1).
const PROJECT_PUBLIC_KEY = 'pk_demo_local';
// Origin of widget-demo-site (Vite :5173). Dashboard runs on :5174 (operator CORS).
const DEMO_ORIGIN = 'http://localhost:5173';

async function seed(): Promise<void> {
  // Standalone Nest context (no HTTP server) — reuses ConfigModule (.env) and the
  // shared DatabaseService pool exactly as the running app would.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const db = app.get(DatabaseService);

  try {
    // Organization. ON CONFLICT (id) DO NOTHING: re-running keeps the existing row.
    await db.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'Acme Inc'],
    );

    // Project. DO UPDATE so re-seeding can refresh the demo origin / public_key
    // (e.g. if we move the demo-site to another port) without a manual edit.
    await db.query(
      `INSERT INTO projects (id, organization_id, name, public_key, allowed_origins)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET public_key      = EXCLUDED.public_key,
             allowed_origins = EXCLUDED.allowed_origins`,
      [PROJECT_ID, ORG_ID, 'Acme Website', PROJECT_PUBLIC_KEY, [DEMO_ORIGIN]],
    );

    // Operator user. Real auth (Google) is v1; here we just need a row with role='operator'.
    await db.query(
      `INSERT INTO users (id, organization_id, email, name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [OPERATOR_ID, ORG_ID, 'operator@demo.local', 'Demo Operator', 'operator'],
    );

    // eslint-disable-next-line no-console -- seed is a CLI script, console is the UI
    console.log(
      `Seed OK\n` +
        `  organization : ${ORG_ID} (Acme Inc)\n` +
        `  project      : ${PROJECT_ID} public_key=${PROJECT_PUBLIC_KEY}\n` +
        `                 allowed_origins=[${DEMO_ORIGIN}]\n` +
        `  operator     : ${OPERATOR_ID} (operator@demo.local)`,
    );
  } finally {
    // Closing the context ends the pool, so the process exits cleanly.
    await app.close();
  }
}

seed().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- surface the failure to the CLI
  console.error('Seed failed:', err);
  process.exit(1);
});
