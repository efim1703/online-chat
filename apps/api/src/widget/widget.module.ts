import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module.js';
import { WidgetController } from './widget.controller.js';
import { WidgetSessionService } from './widget-session.service.js';
import { WidgetSessionGuard } from './widget-session.guard.js';
import { WidgetConversationsController } from './widget-conversations.controller.js';
import { WidgetConversationsService } from './widget-conversations.service.js';

// Feature-модуль виджета. DatabaseService приходит из @Global DatabaseModule;
// MessagesService подключается через MessagesModule (общий с маршрутами оператора,
// v0-4.8). WidgetSessionGuard является провайдером, чтобы Nest мог инжектировать
// в него DatabaseService при работе на маршрутах диалогов.
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
