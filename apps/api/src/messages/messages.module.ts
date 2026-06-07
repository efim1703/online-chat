import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service.js';

// Exports the shared MessagesService. Imported by feature modules that create
// messages (widget now; operator in v0-4.8). DatabaseService comes from the
// @Global DatabaseModule.
@Module({
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
