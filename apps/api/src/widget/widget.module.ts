import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller.js';
import { WidgetSessionService } from './widget-session.service.js';

// Widget feature module. DatabaseService comes from the @Global DatabaseModule,
// so it does not need to be imported here. More widget providers/controllers
// (conversations, messages) join in v0-4.7.
@Module({
  controllers: [WidgetController],
  providers: [WidgetSessionService],
})
export class WidgetModule {}
