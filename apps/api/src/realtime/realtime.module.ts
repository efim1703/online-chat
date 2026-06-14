import { Module } from '@nestjs/common';
import { RealtimeRegistry } from './realtime-registry.service.js';

/**
 * Содержит только RealtimeRegistry и экспортирует его. Намеренно не имеет зависимостей:
 * и MessagesModule (чтобы MessagesService мог рассылать), и gateway импортируют этот
 * модуль, поэтому зависимость от любого из них создала бы циклический импорт на уровне
 * модулей. Сам RealtimeGateway регистрируется в AppModule, где доступны и RealtimeModule,
 * и MessagesModule.
 */
@Module({
  providers: [RealtimeRegistry],
  exports: [RealtimeRegistry],
})
export class RealtimeModule {}
