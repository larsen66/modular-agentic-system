// src/harnesses/sdk/index.ts
// The REAL SDK harness (mode 1, agent-outside + remote-exec). The agent loop runs
// in-process on the control plane; every tool call the LLM makes is dispatched
// through the ToolKit, whose ToolSpecs route OUT to the opaque EnvironmentHandle.
// The harness binary never enters the sandbox.
//
// This harness owns NO tools of its own anymore. It is a thin Adapter: it renders
// kit.tools into the provider-agnostic LlmTool shape, composes its system prompt
// from kit.skills, and emits the tool_call/tool_result correlation pair around
// each spec.execute. Add a tool/skill to the registry → it shows up here for free.
//
// Provider-agnostic: ANTHROPIC_API_KEY → Claude, else OPENAI_API_KEY → GPT.

import { registerHarness } from '../../registry/index.js';
import type { Harness, HarnessCapabilities, RunIO, RunTask, ToolKit } from '../../types/index.js';
import type { EnvironmentHandle } from '../../types/index.js';
import { selectProvider, type LlmMessage, type LlmTool } from './providers/index.js';

const CAPS: HarnessCapabilities = {
  providerAgnostic: true,
  streaming: true,
  topologies: ['agent-as-tool'],
  defaultTopology: 'agent-as-tool',
};

const MAX_STEPS = 16; // safety bound on the agent loop

// Adapter: ToolSpec → provider-agnostic LlmTool. The ONLY harness-specific bit.
function renderTools(kit: ToolKit): LlmTool[] {
  return kit.tools.map((t) => ({
    name: t.ref,
    description: t.description,
    inputSchema: t.parameters,
  }));
}

class SdkHarness implements Harness {
  readonly ref = 'sdk';
  readonly capabilities = CAPS;

  async run(task: RunTask, env: EnvironmentHandle, io: RunIO, kit?: ToolKit): Promise<void> {
    if (!kit) throw new Error('sdk harness requires a ToolKit (kernel did not resolve one)');

    const provider = selectProvider({ model: task.model });
    const system = await kit.systemPreamble();
    const tools = renderTools(kit);

    const messages: LlmMessage[] = [{ role: 'user', content: task.prompt }];
    let inTok = 0;
    let outTok = 0;

    for (let step = 0; step < MAX_STEPS; step++) {
      if (task.signal.aborted) break;

      const result = await provider.step({ system, messages, tools, signal: task.signal });

      inTok += result.usage.inputTokens;
      outTok += result.usage.outputTokens;
      if (result.text) io.emit({ type: 'stream_chunk', text: result.text });

      if (result.toolCalls.length === 0 || result.stopReason === 'end') {
        if (result.text) io.emit({ type: 'final_text', text: result.text });
        break;
      }

      messages.push({ role: 'assistant', text: result.text, toolCalls: result.toolCalls });
      const results = [];
      for (const tc of result.toolCalls) {
        // The harness owns the correlation pair (it minted the provider call id);
        // the ToolSpec owns any semantic events (e.g. preview_ready).
        io.emit({ type: 'tool_call', name: tc.name, args: tc.input, callId: tc.id });
        // sdk owns NO native tools, so every call dispatches to an external spec.
        // A harness WITH native tools branches FIRST on its own set, e.g.:
        //   if (kit.nativeToolRefs.includes(tc.name)) r = await this.execNative(tc, env, io);
        //   else r = await kit.byRef(tc.name)?.execute(...) ?? unknownTool;
        const spec = kit.byRef(tc.name);
        const r = spec
          ? await spec.execute(tc.input, env, io)
          : { content: `unknown tool: ${tc.name}`, isError: true };
        io.emit({ type: 'tool_result', ok: !r.isError, output: r.content.slice(0, 800), callId: tc.id });
        results.push({ toolCallId: tc.id, content: r.content, isError: r.isError });
      }
      messages.push({ role: 'tool_results', results });
    }

    io.emit({ type: 'usage_delta', inputTokens: inTok, outputTokens: outTok });
    io.emit({ type: 'terminal', cause: task.signal.aborted ? 'cancelled' : 'done' });
  }
}

registerHarness('sdk', () => new SdkHarness());
