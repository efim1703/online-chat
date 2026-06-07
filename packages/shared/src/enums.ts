/**
 * Domain enums shared across api, dashboard and widget-sdk.
 *
 * Modeled as `const object + literal union` (not native TS `enum`):
 *  - the values are plain strings, identical to what we store in Postgres TEXT columns;
 *  - no runtime enum object magic, tree-shake friendly, ESM-safe under isolatedModules;
 *  - the union type and the const share a name (TS declaration merging), so consumers
 *    can use `SenderType` both as a type and as a value bag.
 */

/** Who authored a message. Maps to `messages.sender_type`. */
export const SenderType = {
  Visitor: 'visitor',
  Operator: 'operator',
  System: 'system',
} as const;
export type SenderType = (typeof SenderType)[keyof typeof SenderType];

/** Lifecycle of a conversation. Maps to `conversations.status`. */
export const ConversationStatus = {
  /** Created by a visitor, no operator assigned yet. */
  Open: 'open',
  /** An operator picked it up (`assigned_user_id` is set). */
  Assigned: 'assigned',
  /** Resolved / archived. */
  Closed: 'closed',
} as const;
export type ConversationStatus =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];
