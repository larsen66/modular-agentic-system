// src/harnesses/openai-agents/config.ts
// Provider-agnostic model-client configuration for the OpenAI Agents SDK.
//
// The official SDK flow is: define an Agent, then run it. This adapter keeps that
// shape and only customizes the OpenAI client when the platform needs an
// OpenAI-compatible gateway or local verification mock. Chat Completions remains
// the gateway transport because model-router-gw style adapters usually implement
// that OpenAI wire surface before the Responses API.
//
// Resolution order for the base URL:
//   OPENAI_BASE_URL  (explicit; gateway or local mock)         → that
//   OPENAI_AGENTS_BASE_URL (adapter-specific override)         → that
//   else                                                       → SDK default (api.openai.com)

import OpenAI from 'openai';
import {
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from '@openai/agents';

export interface OpenAiAgentsConfig {
  /** True when a usable client can be constructed (real key OR base-url+anykey). */
  available: boolean;
  /** True only when a genuine OPENAI_API_KEY is present with NO base-url override. */
  real: boolean;
  /** The resolved base URL (or the SDK default marker). */
  baseUrl: string;
  /** The model the agent will request. */
  model: string;
  mode: 'real-key' | 'gateway' | 'mock-base-url' | 'unconfigured';
}

const DEFAULT_MODEL = 'gpt-5.4-mini';
const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

export function resolveConfig(opts?: { model?: string }): OpenAiAgentsConfig {
  const apiKey = process.env.OPENAI_API_KEY ?? '';
  const baseUrl = (
    process.env.OPENAI_BASE_URL ??
    process.env.OPENAI_AGENTS_BASE_URL ??
    ''
  ).replace(/\/$/, '');
  const model = opts?.model ?? process.env.OPENAI_AGENTS_MODEL ?? DEFAULT_MODEL;

  const hasBase = baseUrl.length > 0;
  const hasKey = apiKey.length > 0;

  // Available if: a real key (hits OpenAI directly) OR a base URL is set (gateway
  // or mock — key may be a placeholder the upstream ignores).
  const available = hasKey || hasBase;
  const real = hasKey && !hasBase;

  let mode: OpenAiAgentsConfig['mode'];
  if (!available) mode = 'unconfigured';
  else if (real) mode = 'real-key';
  else if (hasBase && /localhost|127\.0\.0\.1/.test(baseUrl)) mode = 'mock-base-url';
  else mode = 'gateway';

  return {
    available,
    real,
    baseUrl: hasBase ? baseUrl : OPENAI_DEFAULT_BASE,
    model,
    mode,
  };
}

/**
 * Install the resolved client as the SDK's default for this process. Throws only
 * when the harness is genuinely unconfigured: no API key and no base URL.
 */
export async function configureClient(opts?: { model?: string }): Promise<OpenAiAgentsConfig> {
  const cfg = resolveConfig(opts);
  if (!cfg.available) {
    throw new NoOpenAiAgentsCredentialError();
  }

  const apiKey = process.env.OPENAI_API_KEY || 'sk-placeholder-gateway-key';
  const client = new OpenAI({ apiKey, baseURL: cfg.baseUrl });

  setDefaultOpenAIClient(client as unknown as Parameters<typeof setDefaultOpenAIClient>[0]);
  // Gateways/mocks implement Chat Completions, not the Responses API.
  setOpenAIAPI('chat_completions');
  // No platform tracing exporter is wired in this kernel — disable so the SDK
  // does not attempt to POST traces to api.openai.com with a placeholder key.
  setTracingDisabled(true);

  return cfg;
}

export class NoOpenAiAgentsCredentialError extends Error {
  constructor() {
    super(
      'OpenAI Agents harness is unconfigured. Set OPENAI_API_KEY for a real model, ' +
        'or set OPENAI_BASE_URL (gateway / local mock) to drive the real harness ' +
        'without a paid key. (See src/harnesses/openai-agents/verify.ts.)'
    );
    this.name = 'NoOpenAiAgentsCredentialError';
  }
}
