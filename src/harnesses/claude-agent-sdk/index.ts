// src/harnesses/claude-agent-sdk/index.ts
// Real `claude-agent-sdk` harness using the official Claude Agent SDK
// (`@anthropic-ai/claude-agent-sdk`, the `query()` loop). The SDK owns the agent
// loop; this harness owns the environment boundary by exposing only in-process MCP
// tools that route every side effect through EnvironmentHandle (mode 1). Built-in
// Read/Write/Bash are disabled and a canUseTool gate denies anything that isn't a
// sandbox tool, so the model can never reach a host-local shell.

import { registerHarness } from '../../registry/index.js';
import type {
  EnvironmentHandle,
  Harness,
  HarnessCapabilities,
  RunIO,
  RunTask,
} from '../../types/index.js';
import { loadAgentSdk, resolveConfig, type AgentSdkMessage } from './client.js';
import { buildSandboxServer, SANDBOX_TOOL_NAMES, SYSTEM } from './tools.js';

const CAPS: HarnessCapabilities = {
  providerAgnostic: false,
  streaming: true,
  topologies: ['agent-as-tool'],
  defaultTopology: 'agent-as-tool',
};

function errEvent(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 'claude_sdk_run_failed', message: message.slice(0, 800) };
}

function emitTextFromMessage(message: AgentSdkMessage, io: RunIO): void {
  const blocks = message.message?.content ?? [];
  let text = '';
  for (const block of blocks) {
    if (block.type === 'text' && block.text) text += block.text;
  }
  if (text) io.emit({ type: 'stream_chunk', text });
}

class ClaudeAgentSdkHarness implements Harness {
  readonly ref = 'claude-agent-sdk';
  readonly capabilities = CAPS;

  async run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    let settled = false;
    const settle = (
      cause: 'done' | 'error' | 'cancelled',
      error?: { code: string; message: string }
    ): void => {
      if (settled) return;
      settled = true;
      io.emit({ type: 'terminal', cause, ...(error ? { error } : {}) });
    };

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const cfg = resolveConfig({ model: task.model });
      if (!cfg) {
        settle('error', {
          code: 'claude_agent_sdk_unconfigured',
          message:
            'claude-agent-sdk is not configured: set ANTHROPIC_API_KEY, or ' +
            'CLAUDE_CODE_OAUTH_TOKEN, or log into Claude Code (Pro/Max), or set ANTHROPIC_BASE_URL.',
        });
        return;
      }

      const sdk = await loadAgentSdk();
      const { server, toolNames } = buildSandboxServer(sdk, env, io);

      // Build the subprocess env per auth mode. CRITICAL for the subscription path:
      // we must NOT inject a placeholder ANTHROPIC_API_KEY — that would force the
      // bundled `claude` binary into (broken) API-key auth instead of letting it
      // read the machine's Pro/Max login from the Keychain / ~/.claude.
      const childEnv: Record<string, string | undefined> = { ...process.env };
      if (cfg.authMode === 'subscription') {
        delete childEnv.ANTHROPIC_API_KEY; // let the subprocess use the subscription login
      } else if (cfg.authMode === 'api-key' && cfg.apiKey) {
        childEnv.ANTHROPIC_API_KEY = cfg.apiKey;
      } else if (cfg.authMode === 'oauth-token' && cfg.oauthToken) {
        childEnv.CLAUDE_CODE_OAUTH_TOKEN = cfg.oauthToken;
        delete childEnv.ANTHROPIC_API_KEY;
      }
      if (cfg.baseURL) childEnv.ANTHROPIC_BASE_URL = cfg.baseURL;

      const stream = sdk.query({
        prompt: task.prompt,
        options: {
          model: cfg.model,
          systemPrompt: SYSTEM,
          tools: [],
          allowedTools: toolNames,
          mcpServers: { sandbox: server },
          permissionMode: 'dontAsk',
          // Hermetic: do NOT load the host's ~/.claude / project .claude (CLAUDE.md,
          // skills, MCP). This harness is a self-contained execution lane.
          settingSources: [],
          canUseTool: async (toolName: string) =>
            SANDBOX_TOOL_NAMES.includes(toolName)
              ? { behavior: 'allow' as const }
              : { behavior: 'deny' as const, message: `Tool is disabled by harness policy: ${toolName}` },
          env: childEnv,
        },
      });

      const closeOnAbort = (): void => stream.close();
      task.signal.addEventListener('abort', closeOnAbort, { once: true });

      try {
        for await (const message of stream) {
          if (task.signal.aborted) {
            settle('cancelled');
            return;
          }

          if (message.type === 'assistant') {
            emitTextFromMessage(message, io);
            inputTokens += message.message?.usage?.input_tokens ?? 0;
            outputTokens += message.message?.usage?.output_tokens ?? 0;
          } else if (message.type === 'result') {
            inputTokens += message.usage?.input_tokens ?? 0;
            outputTokens += message.usage?.output_tokens ?? 0;
            if (message.result) io.emit({ type: 'final_text', text: message.result });
            if (message.is_error) {
              settle('error', {
                code: 'claude_sdk_result_error',
                message: (message.errors?.join('; ') || message.result || 'Claude SDK returned an error').slice(0, 800),
              });
              return;
            }
          }
        }
      } finally {
        task.signal.removeEventListener('abort', closeOnAbort);
      }

      io.emit({ type: 'usage_delta', inputTokens, outputTokens });
      settle(task.signal.aborted ? 'cancelled' : 'done');
    } catch (err) {
      if (task.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        settle('cancelled');
        return;
      }
      io.emit({ type: 'usage_delta', inputTokens, outputTokens });
      settle('error', errEvent(err));
    }
  }
}

registerHarness('claude-agent-sdk', () => new ClaudeAgentSdkHarness());

export { ClaudeAgentSdkHarness };
