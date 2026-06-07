import { Body, Controller, Post } from '@nestjs/common';
import type { CreateSessionInput, WidgetSessionDto } from '@support-widget/shared';
import { WidgetSessionService } from './widget-session.service.js';

/**
 * Public widget-facing HTTP API (no operator auth — these are called by the
 * embedded widget.js on the visitor's page). CORS by allowed_origins lands in
 * v0-4.10; conversation routes land in v0-4.7.
 */
@Controller('widget')
export class WidgetController {
  constructor(private readonly sessions: WidgetSessionService) {}

  // POST /widget/session — exchange a project public_key for a visitor token.
  // No ValidationPipe yet (that is v0-4.10), so the service validates the body.
  @Post('session')
  createSession(@Body() body: CreateSessionInput): Promise<WidgetSessionDto> {
    return this.sessions.createSession(body);
  }
}
