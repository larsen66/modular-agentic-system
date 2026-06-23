// src/harnesses/sdk/providers/types.ts
// A tiny provider-agnostic LLM interface for the SDK harness. Both the Anthropic
// and OpenAI clients normalize their native wire format into this shape so the
// agent loop (loop.ts) never branches on the provider. Provider-agnosticism is a
// baseline harness capability (research §Step-0); this is the seam for it.

export interface LlmTool {
  name: string;
  description: string;
  // JSON Schema for the tool's input (Anthropic input_schema / OpenAI parameters).
  inputSchema: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// One assistant turn: any text it produced, any tool calls it wants run, the
// stop reason, and token usage. The loop emits text/tool events from this.
export interface LlmStep {
  text: string;
  toolCalls: LlmToolCall[];
  stopReason: 'tool_use' | 'end' | 'max_tokens' | 'other';
  usage: { inputTokens: number; outputTokens: number };
}

// Provider-neutral conversation message. Tool results are attached as a
// dedicated role so each client can map them to its native representation.
export type LlmMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; text: string; toolCalls: LlmToolCall[] }
  | { role: 'tool_results'; results: { toolCallId: string; content: string; isError?: boolean }[] };

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
  model: string;
  maxTokens: number;
  signal: AbortSignal;
}

export interface LlmProvider {
  readonly name: 'anthropic' | 'openai';
  readonly model: string;
  step(req: Omit<LlmRequest, 'model' | 'maxTokens'> & { model?: string }): Promise<LlmStep>;
}
