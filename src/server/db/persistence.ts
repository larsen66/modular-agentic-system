// src/server/db/persistence.ts
// The modular run-persistence seam. It taps the SINGLE normalized EngineEvent stream that every
// harness × environment produces, and writes durable history into existing BOS tables:
//   runs / run_events   (runStore)      — run history (/history)
//   chat_messages       (messageStore)  — transcript that survives reload
//   opencode_sessions   (sessionStore)  — session continuity + Explorer health
//
// Why this is harness/environment-agnostic: it consumes ONLY EngineEvent + the run config strings.
// It never branches on which harness or env produced the events — harness/env are stored as labels
// (runs.provider/model, opencode_sessions.engine_ref, metadata.{agent,environment}). Add a new
// harness or env and persistence keeps working with zero changes here.
//
// Everything is BEST-EFFORT and NON-BLOCKING: a write failure is logged and swallowed so a broken
// insert can never abort or stall a live run.

import type { EngineEvent } from '../../types/index.js';
import type { RunResult } from '../../kernel/index.js';
import { createRun, appendRunEvent, completeRun } from './runStore.js';
import { persistMessage } from './messageStore.js';
import { ensureSession, bumpSession } from './sessionStore.js';

export interface RunPersistCtx {
  runId: string;
  ownerId: string;
  projectId: string;
  sessionId: string;
  chatId: string | null;
  harness: string;
  environment: string;
  model: string | null;
  prompt: string;
  startedAt: number;
}

export interface RunPersistence {
  /** Tee target: fold one streamed EngineEvent into the accumulator (+ append run_events). */
  onEvent: (ev: EngineEvent) => void;
  /** Finalize: settle the run row + write the assistant transcript row + bump the session. */
  settle: (result: RunResult) => Promise<void>;
}

// Accumulated assistant-message metadata, matched 1:1 to the prod BOS shape.
interface ToolCallAcc {
  tool: string;
  callID: string;
  toolState: 'running' | 'completed' | 'error';
  raw?: unknown; // tool args → historyMapper renders these
  content?: string; // tool output
  startedAt: number;
}

function providerOf(model: string | null): string | null {
  if (!model) return null;
  const slash = model.indexOf('/');
  return slash === -1 ? model : model.slice(0, slash);
}

function warn(stage: string, e: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[persistence] ${stage}: ${e instanceof Error ? e.message : String(e)}`);
}

// Build the persistence handle for one run. Fires the begin-writes (run row + session + user
// message) immediately, all best-effort.
export async function createRunPersistence(ctx: RunPersistCtx): Promise<RunPersistence> {
  const contentChunks: { text: string; at: number }[] = [];
  const toolCalls: ToolCallAcc[] = [];
  const toolByCall = new Map<string, ToolCallAcc>();
  let finalText = '';
  const provider = providerOf(ctx.model);

  // ── Begin ───────────────────────────────────────────────────────────────────
  // run row first (FK target for run_events); then session + user message in parallel.
  let workspaceId: string | undefined;
  try {
    ({ workspaceId } = await createRun({
      runId: ctx.runId,
      ownerId: ctx.ownerId,
      projectId: ctx.projectId,
      sessionId: ctx.sessionId,
      chatId: ctx.chatId,
      model: ctx.model,
      provider,
    }));
  } catch (e) {
    warn('createRun', e);
  }
  void ensureSession({
    sessionId: ctx.sessionId,
    ownerId: ctx.ownerId,
    projectId: ctx.projectId,
    hostWorkspaceId: workspaceId ?? null,
    engineRef: ctx.harness,
    surfaceKey: `kernel:${ctx.sessionId}`,
  }).catch((e) => warn('ensureSession', e));
  if (ctx.chatId) {
    void persistMessage({
      chatId: ctx.chatId,
      projectId: ctx.projectId,
      ownerId: ctx.ownerId,
      role: 'user',
      content: ctx.prompt,
      metadata: { sentAt: new Date(ctx.startedAt).toISOString() },
    }).catch((e) => warn('userMessage', e));
  }

  // ── Stream fold ───────────────────────────────────────────────────────────────
  const onEvent = (ev: EngineEvent): void => {
    const at = Date.now();
    switch (ev.type) {
      case 'stream_chunk':
        if (ev.text) contentChunks.push({ text: ev.text, at });
        break;
      case 'final_text':
        finalText = ev.text ?? '';
        break;
      case 'tool_call': {
        const callID = ev.callId ?? `call-${toolCalls.length}`;
        const entry: ToolCallAcc = { tool: ev.name, callID, toolState: 'running', raw: ev.args, startedAt: at };
        toolByCall.set(callID, entry);
        toolCalls.push(entry);
        break;
      }
      case 'tool_result': {
        const callID = ev.callId ?? '';
        const existing = toolByCall.get(callID);
        if (existing) {
          existing.toolState = ev.ok ? 'completed' : 'error';
          existing.content = ev.output;
        } else {
          toolCalls.push({ tool: 'tool', callID: callID || `call-${toolCalls.length}`, toolState: ev.ok ? 'completed' : 'error', content: ev.output, startedAt: at });
        }
        break;
      }
      default:
        break;
    }
    // Optional ordered event log for replay. Best-effort, fire-and-forget.
    void appendRunEvent(ctx.runId, ev).catch(() => {});
  };

  // ── Settle ───────────────────────────────────────────────────────────────────
  const settle = async (result: RunResult): Promise<void> => {
    await completeRun(ctx.runId, result, ctx.startedAt).catch((e) => warn('completeRun', e));
    if (ctx.chatId) {
      const content = result.finalText || finalText || contentChunks.map((c) => c.text).join('');
      // NOTE: we deliberately do NOT persist granular `contentChunks`. The frontend historyMapper
      // renders EACH contentChunk as its own `{type:'text'}` part interleaved with tools by
      // timestamp — token-level chunks would explode into dozens of fragments and shatter Markdown
      // on reload. Omitting them makes historyMapper fall back to `content` (the full final text),
      // which it renders as ONE block after the tools — matching the settled live view exactly.
      // (thinkingSteps is always empty for this kernel — the EngineEvent set has no `thinking`.)
      await persistMessage({
        chatId: ctx.chatId,
        projectId: ctx.projectId,
        ownerId: ctx.ownerId,
        role: 'assistant',
        content,
        metadata: {
          agent: ctx.harness,
          model: ctx.model,
          runId: ctx.runId,
          provider,
          toolCalls,
          durationMs: Date.now() - ctx.startedAt,
          environment: ctx.environment,
          usage: result.usage,
          cost: result.cost,
        },
      }).catch((e) => warn('assistantMessage', e));
    }
    void bumpSession(ctx.sessionId, ctx.chatId ? 2 : 0).catch((e) => warn('bumpSession', e));
  };

  return { onEvent, settle };
}
