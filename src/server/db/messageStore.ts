// src/server/db/messageStore.ts
// Service-role WRITE path for durable chat transcript (chat_messages). This is the table the
// frontend's fetchChatHistory reads, so a reopened chat re-hydrates from here. Shapes are matched
// 1:1 to the rows the prod BOS pipeline writes (verified against live BOS):
//   role ∈ {'user','assistant'} · message_type 'text' · status 'done'
//   assistant metadata = { agent, model, runId, provider, toolCalls, durationMs, contentChunks,
//                          thinkingSteps } — toolCalls[].raw carries the tool args so the reader's
//                          historyMapper.toolPart() can render them (matches the live-stream shape).
// MODULAR: nothing here is harness/environment-specific — the caller (persistence.ts) derives the
// content/toolCalls purely from the normalized EngineEvent stream, so every harness × env persists
// through this same writer.

import { admin } from '../supabase.js';

export interface PersistMessageInput {
  chatId: string;
  projectId: string;
  ownerId: string;
  role: 'user' | 'assistant';
  content: string;
  /** Assistant-only structured replay payload (toolCalls/contentChunks/…). User rows pass {sentAt}. */
  metadata?: Record<string, unknown>;
}

// Insert one transcript row. Throws on error so the caller can log; callers treat persistence as
// best-effort and never let a failure break the live run.
export async function persistMessage(input: PersistMessageInput): Promise<void> {
  const { error } = await admin().from('chat_messages').insert({
    chat_id: input.chatId,
    project_id: input.projectId,
    user_id: input.ownerId,
    role: input.role,
    content: input.content,
    message_type: 'text',
    status: 'done',
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`[messageStore] persist ${input.role} failed: ${error.message}`);
}
