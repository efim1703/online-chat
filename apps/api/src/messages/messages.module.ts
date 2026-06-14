import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagesService } from './messages.service.js';

// Экспортирует общий MessagesService. Импортируется feature-модулями, создающими
// сообщения (виджет + оператор). DatabaseService приходит из @Global DatabaseModule;
// RealtimeModule предоставляет RealtimeRegistry, чтобы createMessage мог разослать
// `message:created` после сохранения (v0-4.13).
@Module({
  imports: [RealtimeModule],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
