import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import type { CreateSessionInput } from '@support-widget/shared';

/**
 * Validated body for `POST /widget/session`.
 *
 * `publicKey` is required (identifies the project). `visitorId` is optional — a
 * returning widget replays the id it stored last time; if it is missing or not a
 * UUID the service creates a fresh anonymous visitor (see WidgetSessionService).
 */
export class CreateSessionDto implements CreateSessionInput {
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @IsOptional()
  @IsUUID()
  visitorId?: string;
}
