import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module.js';
import { OperatorConversationsController } from './operator-conversations.controller.js';
import { OperatorConversationsService } from './operator-conversations.service.js';
import { OperatorGuard } from './operator.guard.js';

// Feature-модуль оператора. Делит MessagesService (сохранение + будущая рассылка)
// с виджетной стороной через MessagesModule. DatabaseService и ConfigService
// приходят из @Global DatabaseModule / ConfigModule, чтобы OperatorGuard мог
// инжектировать их при работе на маршрутах диалогов.
@Module({
  imports: [MessagesModule],
  controllers: [OperatorConversationsController],
  providers: [OperatorConversationsService, OperatorGuard],
})
export class OperatorModule {}
