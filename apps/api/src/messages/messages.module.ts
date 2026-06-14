import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagesService } from './messages.service.js';

// Exports the shared MessagesService. Imported by feature modules that create
// messages (widget + operator). DatabaseService comes from the @Global
// DatabaseModule; RealtimeModule provides the RealtimeRegistry so createMessage
// can broadcast `message:created` after persisting (v0-4.13).
@Module({
  imports: [RealtimeModule],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
