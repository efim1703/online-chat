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

// Путь к .env в корне монорепо, относительно этого файла (не cwd), чтобы api
// находил его независимо от того, откуда был запущен. Модуль находится на три
// уровня ниже корня репозитория: apps/api/{src,dist}/app.module.
const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');

// Корневой модуль. RealtimeGateway регистрируется здесь (не внутри RealtimeModule),
// чтобы он мог инжектить RealtimeRegistry (RealtimeModule) и MessagesService
// (MessagesModule) без циклической зависимости на уровне модулей.
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
