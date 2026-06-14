import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { WidgetModule } from './widget/widget.module.js';
import { OperatorModule } from './operator/operator.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { HealthController } from './health/health.controller.js';

// Resolve the monorepo-root .env relative to this file (not cwd), so the api
// finds it regardless of where it was launched from. This module lives at
// apps/api/{src,dist}/app.module — three levels below the repo root.
const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');

// Root module. RealtimeGateway is registered here (not inside RealtimeModule) so
// it can inject both RealtimeRegistry (RealtimeModule) and MessagesService
// (MessagesModule) without creating a module-level import cycle.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvPath,
    }),
    DatabaseModule,
    WidgetModule,
    OperatorModule,
    MessagesModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [RealtimeGateway],
})
export class AppModule {}
