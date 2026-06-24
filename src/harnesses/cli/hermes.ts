// src/harnesses/cli/hermes.ts
// The `hermes-cli` harness — drives the user's LOCAL `hermes` binary in
// documented one-shot chat mode. It prefers OPENROUTER_API_KEY when provided,
// otherwise it reuses the user's existing Hermes profile/config in HERMES_HOME
// or ~/.hermes. We read no Hermes credential files and rely on the shared CLI
// runner to verify that a runnable Vite app was actually generated.

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
  providerAgnostic: true, // Hermes can resolve provider/model from CLI args or its config.
  streaming: false, // `hermes -z` intentionally returns final text only.
  topologies: ['agent-in-sandbox'],
  defaultTopology: 'agent-in-sandbox',
};

function hasOpenRouterEnv(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER);
}

function hermesModel(): string {
  return (
    process.env.HERMES_CLI_MODEL ||
    process.env.HERMES_INFERENCE_MODEL ||
    process.env.OPENAI_AGENTS_MODEL ||
    'openai/gpt-4o-mini'
  );
}

function providerArgs(): string[] {
  if (!hasOpenRouterEnv()) return [];
  return ['--provider', 'openrouter', '--model', hermesModel()];
}

function parseLine(line: string): ParsedCliEvent[] {
  const text = line.trim();
  return text ? [{ kind: 'text', text }] : [];
}

const SPEC: CliSpec = {
  ref: 'hermes-cli',
  bin: 'hermes',
  sandboxSupported: true,
  sandboxInstallHint:
    'For Docker set HERMES_DOCKER_IMAGE to an image with the hermes binary, or pass runtimeProfile for such an image/template.',
  // `chat -q --quiet` is Hermes' documented single-query programmatic path. We
  // add `--yolo` because the workspace is an isolated per-session temp dir and
  // the runner owns post-generation verification. The terminal toolset gives
  // Hermes file/shell capability in that cwd; this runner owns install,
  // dev-server startup, and preview.
  buildArgs: (prompt) => [
    'chat',
    '--yolo',
    '-t',
    'terminal',
    '--quiet',
    ...providerArgs(),
    '-q',
    prompt,
  ],
  authDescription: () =>
    hasOpenRouterEnv()
      ? `OpenRouter env, model ${hermesModel()}`
      : 'existing Hermes profile/config',
  parseLine,
};

class HermesCliHarness implements Harness {
  readonly ref = 'hermes-cli';
  readonly capabilities = CAPS;
  run(task: RunTask, env: EnvironmentHandle, io: RunIO): Promise<void> {
    return runCliHarness(SPEC, task, env, io);
  }
}

registerHarness('hermes-cli', () => new HermesCliHarness());
