import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module.js';
import { WidgetController } from './widget.controller.js';
import { WidgetSessionService } from './widget-session.service.js';
import { WidgetSessionGuard } from './widget-session.guard.js';
import { WidgetConversationsController } from './widget-conversations.controller.js';
import { WidgetConversationsService } from './widget-conversations.service.js';

// Widget feature module. DatabaseService comes from the @Global DatabaseModule;
// MessagesService is pulled in via MessagesModule (shared with operator routes
// in v0-4.8). WidgetSessionGuard is a provider so Nest can inject DatabaseService
// into it when it runs on the conversation routes.
@Module({
  imports: [MessagesModule],
  controllers: [WidgetController, WidgetConversationsController],
  providers: [
    WidgetSessionService,
    WidgetSessionGuard,
    WidgetConversationsService,
  ],
})
export class WidgetModule {}
