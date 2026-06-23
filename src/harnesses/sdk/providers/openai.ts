// src/harnesses/sdk/providers/openai.ts
// Real OpenAI Chat Completions client (provider-agnostic interface). Used when
// only OPENAI_API_KEY is present. OPENAI_BASE_URL allows a local mock. Maps the
// neutral message/tool shapes to OpenAI's `tools` + `tool_calls` + role:"tool".

import type { LlmMessage, LlmProvider, LlmRequest, LlmStep, LlmTool } from './types.js';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_BASE = 'https://api.openai.com/v1';

function toOpenAiMessages(system: string, messages: LlmMessage[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || null,
        tool_calls: m.toolCalls.length
          ? m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.input) },
            }))
          : undefined,
      });
    } else {
      for (const r of m.results)
        out.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: LlmTool[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

export function createOpenAiProvider(opts?: { model?: string }): LlmProvider {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const model = opts?.model ?? process.env.SDK_MODEL ?? DEFAULT_MODEL;

  return {
    name: 'openai',
    model,
    async step(req: Omit<LlmRequest, 'model' | 'maxTokens'> & { model?: string }): Promise<LlmStep> {
      const body = {
        model: req.model ?? model,
        max_tokens: 4096,
        messages: toOpenAiMessages(req.system, req.messages),
        tools: toOpenAiTools(req.tools),
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`openai ${res.status}: ${errText.slice(0, 400)}`);
      }

      const data = (await res.json()) as {
        choices: {
          message: {
            content?: string | null;
            tool_calls?: { id: string; function: { name: string; arguments: string } }[];
          };
          finish_reason: string;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? '';
      const toolCalls = (choice?.message?.tool_calls ?? []).map((tc) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments || '{}');
        } catch {
          input = {};
        }
        return { id: tc.id, name: tc.function.name, input };
      });

      const finish = choice?.finish_reason;
      const stopReason =
        finish === 'tool_calls'
          ? 'tool_use'
          : finish === 'stop'
            ? 'end'
            : finish === 'length'
              ? 'max_tokens'
              : 'other';

      return {
        text,
        toolCalls,
        stopReason,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}
