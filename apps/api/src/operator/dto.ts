import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  ConversationStatus,
  type UpdateConversationInput,
} from '@support-widget/shared';

// Allowed status values, derived from the shared enum so the two never drift.
const CONVERSATION_STATUSES = Object.values(ConversationStatus);

/**
 * Validated body for `PATCH /operator/conversations/:id`.
 *
 * Both fields are optional (partial update). `assignedUserId` may be a UUID
 * (claim) or explicit `null` (unassign). @IsOptional skips validation when the
 * value is null/undefined, so null passes (unassign) while a non-null value must
 * be a UUID.
 */
export class UpdateConversationDto implements UpdateConversationInput {
  @IsOptional()
  @IsIn(CONVERSATION_STATUSES)
  status?: ConversationStatus;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}
