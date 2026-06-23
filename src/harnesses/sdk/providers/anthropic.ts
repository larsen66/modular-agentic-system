// src/harnesses/sdk/providers/anthropic.ts
// Real Anthropic Messages API client (provider-agnostic interface). Uses fetch
// directly (no SDK dep) so the only thing standing between us and a real LLM is
// ANTHROPIC_API_KEY in the env. ANTHROPIC_BASE_URL lets a local mock stand in for
// the wire-level verification (swap the base URL back → real Claude, no code
// change). Translates native message/tool_use/tool_result blocks to/from the
// neutral LlmStep/LlmMessage shapes.

import type { LlmMessage, LlmProvider, LlmRequest, LlmStep, LlmTool } from './types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_BASE = 'https://api.anthropic.com';

interface AnthropicBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function toAnthropicMessages(messages: LlmMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'assistant') {
      const content: unknown[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const tc of m.toolCalls)
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      return { role: 'assistant', content };
    }
    // tool_results → a user turn carrying tool_result blocks (Anthropic shape).
    return {
      role: 'user',
      content: m.results.map((r) => ({
        type: 'tool_result',
        tool_use_id: r.toolCallId,
        content: r.content,
        is_error: r.isError ?? false,
      })),
    };
  });
}

function toAnthropicTools(tools: LlmTool[]): unknown[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export function createAnthropicProvider(opts?: { model?: string }): LlmProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const model = opts?.model ?? process.env.SDK_MODEL ?? DEFAULT_MODEL;

  return {
    name: 'anthropic',
    model,
    async step(req: Omit<LlmRequest, 'model' | 'maxTokens'> & { model?: string }): Promise<LlmStep> {
      const body = {
        model: req.model ?? model,
        max_tokens: 4096,
        system: req.system,
        messages: toAnthropicMessages(req.messages),
        tools: toAnthropicTools(req.tools),
      };

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`anthropic ${res.status}: ${errText.slice(0, 400)}`);
      }

      const data = (await res.json()) as {
        content: AnthropicBlock[];
        stop_reason: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      let text = '';
      const toolCalls = [];
      for (const block of data.content ?? []) {
        if (block.type === 'text') text += block.text ?? '';
        else if (block.type === 'tool_use')
          toolCalls.push({ id: block.id ?? '', name: block.name ?? '', input: block.input ?? {} });
      }

      const stopReason =
        data.stop_reason === 'tool_use'
          ? 'tool_use'
          : data.stop_reason === 'end_turn'
            ? 'end'
            : data.stop_reason === 'max_tokens'
              ? 'max_tokens'
              : 'other';

      return {
        text,
        toolCalls,
        stopReason,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}
