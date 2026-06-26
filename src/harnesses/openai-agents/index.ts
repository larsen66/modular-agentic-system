// src/harnesses/openai-agents/index.ts
// OpenAI Agents SDK harness (mode 1: agent-outside + remote-exec). The SDK owns
// the agent loop; this adapter owns the environment tool seam and EngineEvent
// projection. Every model tool call routes to the opaque EnvironmentHandle.

import { Agent, run, tool, type ModelResponse } from '@openai/agents';
import { registerHarness } from '../../registry/index.js';
import type {
  EnvironmentHandle,
  Harness,
  HarnessCapabilities,
  RunIO,
  RunTask,
} from '../../types/index.js';
import { configureClient, resolveConfig, NoOpenAiAgentsCredentialError } from './config.js';
import { buildEnvTools } from './tools.js';
import { projectStreamEvent } from './events.js';
import { SYSTEM_INSTRUCTIONS } from './execEngine.js';
import { createSettler, toErrorMessage, truncate } from '../_shared/harnessRuntime.js';

const CAPS: HarnessCapabilities = {
  providerAgnostic: true,
  streaming: true,
  topologies: ['agent-as-tool'],
  defaultTopology: 'agent-as-tool',
};

const MAX_TURNS = 24; // safety bound on the agent loop (SDK enforces maxTurns)

function errEvent(err: unknown): { code: string; message: string } {
  const code =
    err instanceof Error && err.name === 'NoOpenAiAgentsCredentialError'
      ? 'harness_unconfigured'
      : 'harness_error';
  return { code, message: truncate(toErrorMessage(err)) };
}

function sumUsage(rawResponses: ModelResponse[]): { inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  for (const response of rawResponses) {
    inputTokens += response.usage?.inputTokens ?? 0;
    outputTokens += response.usage?.outputTokens ?? 0;
  }
  return { inputTokens, outputTokens };
}

class OpenAiAgentsHarness implements Harness {
  readonly ref = 'openai-agents';
  readonly capabilities = CAPS;

  async run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    let previewReady = false;
    const { settle } = createSettler(io);
    const runIo: RunIO = {
      emit: (ev) => {
        if (ev.type === 'preview_ready') previewReady = true;
        io.emit(ev);
      },
    };

    try {
      // Fail fast on the one genuinely-required credential (no key AND no base).
      const probe = resolveConfig({ model: task.model });
      if (!probe.available) throw new NoOpenAiAgentsCredentialError();

      const cfg = await configureClient({ model: task.model });
      io.emit({
        type: 'log',
        category: 'harness',
        level: 'info',
        message: `openai-agents: SDK path model=${cfg.model} mode=${cfg.mode} base=${cfg.baseUrl}`,
        at: Date.now(),
      });

      const agent = new Agent({
        name: 'BuilderAgent',
        instructions: SYSTEM_INSTRUCTIONS,
        model: cfg.model,
        tools: buildEnvTools(tool, env, runIo),
      });

      const stream = await run(agent, task.prompt, {
        stream: true,
        maxTurns: MAX_TURNS,
        signal: task.signal,
      });

      let accumulated = '';
      for await (const ev of stream) {
        if (task.signal.aborted) break;
        const chunk = projectStreamEvent(ev, runIo);
        if (chunk) accumulated += chunk;
      }

      // Drain the stream machinery before reading the resolved result.
      await stream.completed;

      if (task.signal.aborted) return settle('cancelled');

      const finalText =
        typeof stream.finalOutput === 'string' && stream.finalOutput.length > 0
          ? stream.finalOutput
          : accumulated;
      if (finalText) io.emit({ type: 'final_text', text: finalText });

      const usage = sumUsage(stream.rawResponses);
      io.emit({ type: 'usage_delta', ...usage });

      if (!previewReady) {
        return settle('error', {
          code: 'preview_not_ready',
          message: 'The app did not emit preview_ready. Fix the dev-server/install error and expose the port before finishing.',
        });
      }

      settle('done');
    } catch (err) {
      if (task.signal.aborted) return settle('cancelled');
      const e = errEvent(err);
      io.emit({
        type: 'log',
        category: 'harness',
        level: 'error',
        message: `openai-agents failed: ${e.message}`,
        at: Date.now(),
      });
      settle('error', e);
    } finally {
      // Last-resort guarantee: settlement NEVER skipped.
      settle('error', { code: 'harness_no_settlement', message: 'run ended without settling' });
    }
  }
}

registerHarness('openai-agents', () => new OpenAiAgentsHarness());

export default new OpenAiAgentsHarness();
