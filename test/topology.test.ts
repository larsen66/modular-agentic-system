import { describe, it, expect, beforeAll } from 'vitest';
import { resolveTopology } from '../src/kernel/capabilities.js';
import { Orchestrator } from '../src/kernel/orchestrator.js';
import { PreviewRegistry } from '../src/kernel/preview.js';
import { registerHarness } from '../src/registry/index.js';
import type {
  EngineEvent,
  EnvironmentCapabilities,
  EnvironmentHandle,
  ExecutionTopology,
  Harness,
  HarnessCapabilities,
  RunIO,
  RunTask,
  ToolKit,
} from '../src/types/index.js';

const asTool: HarnessCapabilities = {
  topologies: ['agent-as-tool'],
  defaultTopology: 'agent-as-tool',
};
const inSandbox: HarnessCapabilities = {
  topologies: ['agent-in-sandbox'],
  defaultTopology: 'agent-in-sandbox',
};
const dual: HarnessCapabilities = {
  topologies: ['agent-as-tool', 'agent-in-sandbox'],
  defaultTopology: 'agent-in-sandbox',
};

const hosting: EnvironmentCapabilities = {
  publicPorts: true,
  pty: false,
  snapshot: false,
  nativeGit: false,
  fileWatch: false,
  persistentVolume: false,
  hostsAgentRuntime: true,
};
const notHosting: EnvironmentCapabilities = { ...hosting, hostsAgentRuntime: false };

describe('resolveTopology', () => {
  it('agent-as-tool runs on ANY env (no hostsAgentRuntime needed)', () => {
    expect(resolveTopology(asTool, notHosting)).toEqual({ ok: true, topology: 'agent-as-tool' });
  });

  it('agent-in-sandbox needs a hosting env', () => {
    expect(resolveTopology(inSandbox, hosting)).toEqual({ ok: true, topology: 'agent-in-sandbox' });
    const denied = resolveTopology(inSandbox, notHosting);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('unsupported_topology');
  });

  it('honours an explicit request the pair supports', () => {
    expect(resolveTopology(dual, hosting, 'agent-as-tool')).toEqual({
      ok: true,
      topology: 'agent-as-tool',
    });
    expect(resolveTopology(dual, hosting, 'agent-in-sandbox')).toEqual({
      ok: true,
      topology: 'agent-in-sandbox',
    });
  });

  it('rejects a request the harness does not support', () => {
    const denied = resolveTopology(asTool, hosting, 'agent-in-sandbox');
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.message).toMatch(/does not support/);
  });

  it('falls back to a hostable topology when the default cannot run', () => {
    // dual default is agent-in-sandbox; a non-hosting env forces agent-as-tool.
    expect(resolveTopology(dual, notHosting)).toEqual({ ok: true, topology: 'agent-as-tool' });
  });
});

// A dual-topology harness that records which topology the kernel resolved.
let seenTopology: ExecutionTopology | undefined;
const dualHarness = (): Harness => ({
  ref: 'dual-stub',
  capabilities: dual,
  async run(task: RunTask, _env: EnvironmentHandle, io: RunIO, _kit?: ToolKit) {
    seenTopology = task.topology;
    io.emit({ type: 'terminal', cause: 'done' });
  },
});

function handleWith(caps: EnvironmentCapabilities): EnvironmentHandle {
  return { id: 'h', capabilities: caps } as EnvironmentHandle;
}

describe('orchestrator topology resolution', () => {
  beforeAll(async () => {
    await import('../src/tools/index.js');
    registerHarness('dual-stub', dualHarness);
  });

  it('threads the resolved topology onto RunTask', async () => {
    const orch = new Orchestrator({ preview: new PreviewRegistry() });
    await orch.run({
      runId: 'r1',
      sessionId: 's1',
      harnessRef: 'dual-stub',
      prompt: 'hi',
      handle: handleWith(hosting),
      signal: new AbortController().signal,
      topology: 'agent-as-tool',
      toolRefs: [],
      skillRefs: [],
      emit: () => {},
    });
    expect(seenTopology).toBe('agent-as-tool');
  });

  it('settles unsupported_topology as a clean terminal (never reaches the harness)', async () => {
    seenTopology = undefined;
    const orch = new Orchestrator({ preview: new PreviewRegistry() });
    const events: EngineEvent[] = [];
    await orch.run({
      runId: 'r2',
      sessionId: 's2',
      harnessRef: 'dual-stub',
      prompt: 'hi',
      handle: handleWith(notHosting), // cannot host → agent-in-sandbox request invalid
      signal: new AbortController().signal,
      topology: 'agent-in-sandbox',
      toolRefs: [],
      skillRefs: [],
      emit: (ev) => events.push(ev),
    });
    expect(seenTopology).toBeUndefined();
    const terminal = events.find((e) => e.type === 'terminal');
    expect(terminal).toMatchObject({ cause: 'error', error: { code: 'unsupported_topology' } });
  });
});
