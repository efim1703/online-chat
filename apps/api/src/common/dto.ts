import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateMessageInput } from '@support-widget/shared';

/**
 * Validated body for the message-create routes (widget and operator).
 *
 * `implements CreateMessageInput` keeps this class tied to the shared wire
 * contract — if the interface gains a field, this stops compiling until we add it.
 * The body is trimmed first (so " " is rejected, not stored) and must be non-empty.
 */
export class CreateMessageDto implements CreateMessageInput {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  body!: string;
}
