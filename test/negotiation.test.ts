import { describe, it, expect, beforeAll } from 'vitest';
import { Orchestrator } from '../src/kernel/orchestrator.js';
import { PreviewRegistry } from '../src/kernel/preview.js';
import { registerHarness } from '../src/registry/index.js';
import type { EngineEvent, EnvironmentHandle, Harness, RunIO, RunTask, ToolKit } from '../src/types/index.js';

// A harness that owns read/write natively and captures the kit it receives so we
// can assert the kernel's native-wins partition.
let captured: ToolKit | undefined;

const nativeHarness = (): Harness => ({
  ref: 'native-stub',
  capabilities: {
    topologies: ['agent-as-tool'],
    defaultTopology: 'agent-as-tool',
    streaming: true,
    providerAgnostic: true,
    nativeTools: ['read', 'write'],
  },
  async run(_task: RunTask, _env: EnvironmentHandle, io: RunIO, kit?: ToolKit) {
    captured = kit;
    io.emit({ type: 'terminal', cause: 'done' });
  },
});

describe('capability negotiation (native wins)', () => {
  beforeAll(async () => {
    // Canonical tools must be registered so external refs resolve.
    await import('../src/tools/index.js');
    registerHarness('native-stub', nativeHarness);
  });

  it('partitions requested refs: native to the harness, the rest external', async () => {
    const orch = new Orchestrator({ preview: new PreviewRegistry() });
    const events: EngineEvent[] = [];
    await orch.run({
      runId: 'r1',
      sessionId: 's1',
      harnessRef: 'native-stub',
      prompt: 'hi',
      handle: {} as EnvironmentHandle,
      signal: new AbortController().signal,
      toolRefs: ['read', 'write', 'bash', 'expose_port'], // read/write native, bash/expose_port external
      skillRefs: [],
      emit: (ev) => events.push(ev),
    });

    expect(captured).toBeDefined();
    // Native refs handed to the harness, NOT resolved as external specs:
    expect(captured!.nativeToolRefs.sort()).toEqual(['read', 'write']);
    // External specs resolved for exactly the non-native refs:
    expect(captured!.tools.map((t) => t.ref).sort()).toEqual(['bash', 'expose_port']);
    expect(captured!.byRef('read')).toBeUndefined(); // harness owns it, no external spec
    expect(captured!.byRef('bash')?.ref).toBe('bash');
  });

  it('an unknown EXTERNAL ref (no native fallback) settles as unknown_capability_ref', async () => {
    const orch = new Orchestrator({ preview: new PreviewRegistry() });
    const events: EngineEvent[] = [];
    await orch.run({
      runId: 'r2',
      sessionId: 's2',
      harnessRef: 'native-stub',
      prompt: 'hi',
      handle: {} as EnvironmentHandle,
      signal: new AbortController().signal,
      toolRefs: ['read', 'does-not-exist'], // read is native; the other has no spec
      skillRefs: [],
      emit: (ev) => events.push(ev),
    });
    const terminal = events.find((e) => e.type === 'terminal');
    expect(terminal).toMatchObject({ cause: 'error', error: { code: 'unknown_capability_ref' } });
  });
});
