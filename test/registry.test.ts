import { describe, it, expect } from 'vitest';
import { createRegistry, UnknownRefError } from '../src/registry/index.js';
import type { Environment, Harness } from '../src/types/index.js';

const stubHarness = (ref: string): Harness => ({
  ref,
  capabilities: { topologies: ['agent-as-tool'], defaultTopology: 'agent-as-tool', streaming: true, providerAgnostic: true },
  async run() {},
});

const stubEnv = (ref: string): Environment => ({
  ref,
  capabilities: {
    publicPorts: false,
    pty: false,
    snapshot: false,
    nativeGit: false,
    fileWatch: false,
    persistentVolume: false,
    hostsAgentRuntime: false,
  },
  async provision() {
    throw new Error('not used');
  },
});

describe('registry', () => {
  it('registers, resolves, and lists both seams', () => {
    const r = createRegistry();
    r.registerHarness('a', () => stubHarness('a'));
    r.registerHarness('b', () => stubHarness('b'));
    r.registerEnvironment('x', () => stubEnv('x'));

    expect(r.listHarnesses().sort()).toEqual(['a', 'b']);
    expect(r.listEnvironments()).toEqual(['x']);
    expect(r.resolveHarness('a').ref).toBe('a');
    expect(r.resolveEnvironment('x').ref).toBe('x');
  });

  it('throws UnknownRefError for an absent ref', () => {
    const r = createRegistry();
    expect(() => r.resolveHarness('nope')).toThrow(UnknownRefError);
    expect(() => r.resolveEnvironment('nope')).toThrow(UnknownRefError);
  });

  it('is append-only (double register throws)', () => {
    const r = createRegistry();
    r.registerHarness('a', () => stubHarness('a'));
    expect(() => r.registerHarness('a', () => stubHarness('a'))).toThrow(/already registered/);
  });

  it('two registries are independent (no globalThis singleton)', () => {
    const r1 = createRegistry();
    const r2 = createRegistry();
    r1.registerHarness('only-in-r1', () => stubHarness('only-in-r1'));
    expect(r1.listHarnesses()).toContain('only-in-r1');
    expect(r2.listHarnesses()).not.toContain('only-in-r1');
  });
});
