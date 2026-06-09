import { Body, Controller, Post } from '@nestjs/common';
import type { WidgetSessionDto } from '@support-widget/shared';
import { WidgetSessionService } from './widget-session.service.js';
import { CreateSessionDto } from './dto.js';

/**
 * Public widget-facing HTTP API (no operator auth — these are called by the
 * embedded widget.js on the visitor's page). CORS by allowed_origins is applied
 * globally (see buildCorsOptions).
 */
@Controller('widget')
export class WidgetController {
  constructor(private readonly sessions: WidgetSessionService) {}

  // POST /widget/session — exchange a project public_key for a visitor token.
  // Body validated by the global ValidationPipe against CreateSessionDto.
  @Post('session')
  createSession(@Body() body: CreateSessionDto): Promise<WidgetSessionDto> {
    return this.sessions.createSession(body);
  }
}
