// src/harnesses/cli/claude.ts
// The `claude-cli` harness — drives the user's LOCAL `claude` binary headless,
// reusing its existing claude.ai/Anthropic login (NO API key). Proven: a headless
// `claude -p … --output-format stream-json` run generates a full app using the
// stored login (apiKeySource:"none" in the init frame).
//
// We translate Claude Code's stream-json firehose into the canonical EngineEvent
// set: assistant text → stream_chunk, tool_use → tool_call, tool_result →
// tool_result, the final `result` frame → usage + final_text. SECURITY: we parse
// only structural fields; we never emit credential/key material.

import { registerHarness } from '../../registry/index.js';
import type {
  EnvironmentHandle,
  Harness,
  HarnessCapabilities,
  RunIO,
  RunTask,
} from '../../types/index.js';
import { runCliHarness, type CliSpec, type ParsedCliEvent } from './run-cli.js';

const CAPS: HarnessCapabilities = {
  providerAgnostic: false, // Anthropic-only by definition (it's the Claude CLI)
  streaming: true,
  topologies: ['agent-in-sandbox'], // the CLI runs the loop AND writes files in the env
  defaultTopology: 'agent-in-sandbox',
};

// stream-json: one JSON object per line. Shapes we care about:
//   { type:'assistant', message:{ content:[ {type:'text',text}, {type:'tool_use',name,id,input} ] } }
//   { type:'user',      message:{ content:[ {type:'tool_result',tool_use_id,content,is_error} ] } }
//   { type:'result',    usage:{ input_tokens, output_tokens }, result:'…' }
function parseLine(line: string): ParsedCliEvent[] {
  let o: any;
  try {
    o = JSON.parse(line);
  } catch {
    return [];
  }
  const out: ParsedCliEvent[] = [];

  if (o?.type === 'assistant' && Array.isArray(o?.message?.content)) {
    for (const block of o.message.content) {
      if (block?.type === 'text' && block.text) out.push({ kind: 'text', text: block.text });
      else if (block?.type === 'tool_use') {
        const name = String(block.name ?? 'tool');
        const path = block?.input?.path ?? block?.input?.file_path;
        out.push({
          kind: 'tool_call',
          name,
          callId: block.id,
          argsSummary: path ? String(path) : undefined,
        });
      }
    }
  } else if (o?.type === 'user' && Array.isArray(o?.message?.content)) {
    for (const block of o.message.content) {
      if (block?.type === 'tool_result') {
        out.push({
          kind: 'tool_result',
          ok: !block.is_error,
          callId: block.tool_use_id,
          output: typeof block.content === 'string' ? block.content.slice(0, 200) : undefined,
        });
      }
    }
  } else if (o?.type === 'result') {
    const u = o?.usage ?? {};
    out.push({
      kind: 'usage',
      inputTokens: Number(u.input_tokens ?? 0),
      outputTokens: Number(u.output_tokens ?? 0),
    });
  }
  return out;
}

const SPEC: CliSpec = {
  ref: 'claude-cli',
  bin: 'claude',
  // -p print/headless, acceptEdits so it actually writes, stream-json for events.
  // --add-dir . so tool access is scoped to the workspace it runs in.
  buildArgs: (prompt) => [
    '-p',
    prompt,
    '--permission-mode',
    'acceptEdits',
    '--add-dir',
    '.',
    '--output-format',
    'stream-json',
    '--verbose',
  ],
  parseLine,
};

class ClaudeCliHarness implements Harness {
  readonly ref = 'claude-cli';
  readonly capabilities = CAPS;
  run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    return runCliHarness(SPEC, task, env, io);
  }
}

registerHarness('claude-cli', () => new ClaudeCliHarness());
