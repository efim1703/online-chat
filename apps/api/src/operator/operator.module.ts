import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module.js';
import { OperatorConversationsController } from './operator-conversations.controller.js';
import { OperatorConversationsService } from './operator-conversations.service.js';
import { OperatorGuard } from './operator.guard.js';

// Operator feature module. Shares MessagesService (persist + future broadcast)
// with the widget side via MessagesModule. DatabaseService and ConfigService
// come from the @Global DatabaseModule / ConfigModule, so OperatorGuard can
// inject them when it runs on the conversation routes.
@Module({
  imports: [MessagesModule],
  controllers: [OperatorConversationsController],
  providers: [OperatorConversationsService, OperatorGuard],
})
export class OperatorModule {}
