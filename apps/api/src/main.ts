// reflect-metadata нужно импортировать один раз, до загрузки любого декорированного класса,
// чтобы NestJS мог читать DI-метаданные, эмитируемые компилятором TypeScript.
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
// NodeNext ESM требует расширение .js в относительных импортах.
import { AppModule } from './app.module.js';
import { buildCorsOptions } from './common/cors.js';
import { DatabaseService } from './database/database.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Realtime-транспорт: заменяем дефолтный адаптер Nest (Socket.IO) на нативный ws-адаптер.
  // RealtimeGateway будет говорить на JSON-конверте `{ event, data }` из @support-widget/shared.
  // Должно быть установлено до app.listen, чтобы gateway привязался к тому же HTTP-серверу
  // (один порт для HTTP + WS).
  app.useWebSocketAdapter(new WsAdapter(app));

  // Глобальная валидация: каждый @Body(), типизированный как DTO-класс, проходит
  // через class-validator. whitelist убирает неизвестные поля; transform строит
  // настоящие экземпляры DTO (чтобы @Transform-обрезки работали и типы приводились).
  // WsAdapter подключается отдельно в v0-4.11 — здесь ещё не нужно.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS: разрешаем origin дашборда + объединение allowed_origins всех проектов
  // (см. buildCorsOptions). Пул БД уже доступен из @Global DatabaseModule,
  // поэтому переиспользуем его для кешированного поиска origin.
  const db = app.get(DatabaseService);
  const dashboardOrigin = config.getOrThrow<string>('DASHBOARD_ORIGIN');
  app.enableCors(buildCorsOptions(db, dashboardOrigin));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void bootstrap();
