// src/harnesses/cli/codex.ts
// The `codex-cli` harness — drives the user's LOCAL `codex` binary headless,
// reusing its existing ChatGPT/OpenAI login in ~/.codex/auth.json (NO API key).
// Proven: `codex exec --json … "<prompt>"` generates files non-interactively
// using the stored login.
//
// We translate Codex's JSONL event stream into EngineEvents:
//   item.completed/agent_message → final/stream text
//   item.completed/file_change   → tool_call/tool_result (which files it wrote)
//   item.completed/command_execution → tool_call/tool_result
//   turn.completed.usage         → usage
// SECURITY: structural fields only; never any token/key material.

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
  providerAgnostic: false, // OpenAI-only by definition (it's the Codex CLI)
  streaming: true,
  topologies: ['agent-in-sandbox'], // the CLI runs the loop AND writes files in the env
  defaultTopology: 'agent-in-sandbox',
};

function parseLine(line: string): ParsedCliEvent[] {
  let o: any;
  try {
    o = JSON.parse(line);
  } catch {
    return [];
  }
  const out: ParsedCliEvent[] = [];

  if (o?.type === 'item.completed' && o?.item) {
    const it = o.item;
    if (it.type === 'agent_message' && it.text) {
      out.push({ kind: 'text', text: it.text });
    } else if (it.type === 'file_change' && Array.isArray(it.changes)) {
      // Summarize the files touched (basename only — no content).
      const files = it.changes
        .map((c: any) => String(c?.path ?? '').split('/').pop())
        .filter(Boolean)
        .slice(0, 6)
        .join(', ');
      out.push({ kind: 'tool_call', name: 'write_file', callId: it.id, argsSummary: files });
      out.push({
        kind: 'tool_result',
        ok: it.status !== 'failed',
        callId: it.id,
        output: files,
      });
    } else if (it.type === 'command_execution') {
      const cmd = String(it.command ?? '').slice(0, 120);
      out.push({ kind: 'tool_call', name: 'run_command', callId: it.id, argsSummary: cmd });
      out.push({
        kind: 'tool_result',
        ok: it.status !== 'failed' && (it.exit_code ?? 0) === 0,
        callId: it.id,
        output: cmd,
      });
    }
  } else if (o?.type === 'turn.completed' && o?.usage) {
    out.push({
      kind: 'usage',
      inputTokens: Number(o.usage.input_tokens ?? 0),
      outputTokens: Number(o.usage.output_tokens ?? 0),
    });
  }
  return out;
}

const SPEC: CliSpec = {
  ref: 'codex-cli',
  bin: 'codex',
  // exec = non-interactive; --json = JSONL events; --skip-git-repo-check because
  // our workspace is a bare temp dir; the bypass flag lets it write files without
  // an interactive approval prompt (we run it in an isolated per-session dir).
  // NOTE: keep this to the flags that exist in the installed codex CLI. Codex
  // 0.141.0 dropped/renamed `--ephemeral`/`--ignore-user-config`/`--ignore-rules`/
  // `--disable apps`; passing them made `codex exec` fail before generation. The
  // minimal working set below was verified live (exec --json + skip-git +
  // bypass-sandbox) to generate files non-interactively.
  buildArgs: (prompt) => [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--dangerously-bypass-approvals-and-sandbox',
    prompt,
  ],
  parseLine,
};

class CodexCliHarness implements Harness {
  readonly ref = 'codex-cli';
  readonly capabilities = CAPS;
  run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    return runCliHarness(SPEC, task, env, io);
  }
}

registerHarness('codex-cli', () => new CodexCliHarness());
