import {
  type ConversationDto,
  type ConversationStatus,
  type MessageDto,
  type SenderType,
} from '@support-widget/shared';

/**
 * Raw row shapes as node-postgres returns them: snake_case columns, TIMESTAMP
 * columns parsed into JS `Date`. The mappers below turn them into the camelCase,
 * ISO-string DTOs shared with the widget and dashboard.
 */

// Column lists kept next to the row types and mappers, so every query that
// builds a ConversationRow / MessageRow selects exactly the shape the mapper
// expects. Shared by the widget and operator services.
export const CONVERSATION_COLUMNS =
  'id, project_id, visitor_id, assigned_user_id, status, created_at, updated_at';

export const MESSAGE_COLUMNS =
  'id, conversation_id, sender_type, sender_id, body, created_at, delivered_at, read_at';

export interface ConversationRow {
  id: string;
  project_id: string;
  visitor_id: string;
  assigned_user_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_id: string | null;
  body: string;
  created_at: Date;
  delivered_at: Date | null;
  read_at: Date | null;
}

export function rowToConversationDto(r: ConversationRow): ConversationDto {
  return {
    id: r.id,
    projectId: r.project_id,
    visitorId: r.visitor_id,
    assignedUserId: r.assigned_user_id,
    // status/sender_type are TEXT in PG but constrained to our enums in app code.
    status: r.status as ConversationStatus,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export function rowToMessageDto(r: MessageRow): MessageDto {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderType: r.sender_type as SenderType,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at.toISOString(),
    deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null,
    readAt: r.read_at ? r.read_at.toISOString() : null,
  };
}
