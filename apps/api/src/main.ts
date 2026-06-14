// reflect-metadata must be imported once, before any decorated class is loaded,
// so NestJS can read the DI metadata emitted by the TypeScript compiler.
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
// NodeNext ESM requires the .js extension on relative imports.
import { AppModule } from './app.module.js';
import { buildCorsOptions } from './common/cors.js';
import { DatabaseService } from './database/database.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Realtime transport: switch Nest's default (Socket.IO) WebSocket adapter for
  // the native `ws`-based one. RealtimeGateway then speaks the JSON `{ event, data }`
  // envelope from @support-widget/shared. Must be set before app.listen so the
  // gateway binds to the same HTTP server (a single port for HTTP + WS).
  app.useWebSocketAdapter(new WsAdapter(app));

  // Global validation: every @Body() typed as a DTO class is run through
  // class-validator. whitelist strips unknown props; transform builds real DTO
  // instances (so @Transform trims run and types coerce). The WebSocket adapter
  // (WsAdapter) is wired separately in v0-4.11 — not here yet.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS: allow the dashboard origin + the union of all projects' allowed_origins
  // (see buildCorsOptions). The DB pool is already available from the @Global
  // DatabaseModule, so we reuse it for the cached origin lookup.
  const db = app.get(DatabaseService);
  const dashboardOrigin = config.getOrThrow<string>('DASHBOARD_ORIGIN');
  app.enableCors(buildCorsOptions(db, dashboardOrigin));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
