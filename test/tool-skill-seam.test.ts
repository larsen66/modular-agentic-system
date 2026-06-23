import { describe, it, expect } from 'vitest';
import { createRegistry, UnknownRefError } from '../src/registry/index.js';
import type { EnvironmentHandle, RunIO, ToolSpec, SkillSpec } from '../src/types/index.js';

const stubTool = (ref: string): ToolSpec => ({
  ref,
  description: `tool ${ref}`,
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  async execute(_input: Record<string, unknown>, _env: EnvironmentHandle, _io: RunIO) {
    return { content: `ran ${ref}`, isError: false };
  },
});

const stubSkill = (ref: string, text: string): SkillSpec => ({
  ref,
  description: `skill ${ref}`,
  instructions: () => text,
});

describe('tool + skill seam', () => {
  it('registers, resolves, and builds a kit', async () => {
    const r = createRegistry();
    r.registerTool('write', () => stubTool('write'));
    r.registerTool('bash', () => stubTool('bash'));
    r.registerSkill('builder', () => stubSkill('builder', 'BUILD INSTRUCTIONS'));

    expect(r.listTools().sort()).toEqual(['bash', 'write']);
    expect(r.listSkills()).toEqual(['builder']);

    const kit = r.buildKit(['write', 'bash'], ['builder']);
    expect(kit.tools.map((t) => t.ref)).toEqual(['write', 'bash']);
    expect(kit.byRef('bash')?.ref).toBe('bash');
    expect(kit.byRef('missing')).toBeUndefined();
  });

  it('dispatches through byRef and routes execute results', async () => {
    const r = createRegistry();
    r.registerTool('write', () => stubTool('write'));
    const kit = r.buildKit(['write'], []);
    const res = await kit
      .byRef('write')!
      .execute({}, {} as EnvironmentHandle, { emit() {} });
    expect(res).toEqual({ content: 'ran write', isError: false });
  });

  it('systemPreamble concatenates base + skill instructions', async () => {
    const r = createRegistry();
    r.registerSkill('a', () => stubSkill('a', 'AAA'));
    r.registerSkill('b', () => stubSkill('b', 'BBB'));
    const kit = r.buildKit([], ['a', 'b']);
    expect(await kit.systemPreamble('PERSONA')).toBe('PERSONA\n\n---\n\nAAA\n\n---\n\nBBB');
    expect(await kit.systemPreamble()).toBe('AAA\n\n---\n\nBBB');
  });

  it('throws UnknownRefError on an absent tool/skill ref', () => {
    const r = createRegistry();
    expect(() => r.buildKit(['nope'], [])).toThrow(UnknownRefError);
    expect(() => r.buildKit([], ['nope'])).toThrow(UnknownRefError);
  });

  it('carries native refs through without resolving them (native-only ref need not exist)', () => {
    const r = createRegistry();
    r.registerTool('bash', () => stubTool('bash'));
    // 'grep' is NATIVE-only — no external spec registered. buildKit must NOT try
    // to resolve it (that is the harness's job), only pass it through.
    const kit = r.buildKit(['bash'], [], ['read', 'write', 'grep'], ['persona']);
    expect(kit.tools.map((t) => t.ref)).toEqual(['bash']); // only external resolved
    expect(kit.nativeToolRefs).toEqual(['read', 'write', 'grep']);
    expect(kit.nativeSkillRefs).toEqual(['persona']);
    expect(kit.byRef('bash')?.ref).toBe('bash');
    expect(kit.byRef('read')).toBeUndefined(); // native → not in external byRef map
  });

  it('is append-only for tools and skills', () => {
    const r = createRegistry();
    r.registerTool('write', () => stubTool('write'));
    expect(() => r.registerTool('write', () => stubTool('write'))).toThrow(/already registered/);
  });
});

describe('canonical tool + skill registration (self-register on import)', () => {
  it('the default builder kit resolves the full OpenCode-parity surface', async () => {
    // Import for side effects: the canonical sets self-register into the default
    // process-wide registry.
    await import('../src/tools/index.js');
    await import('../src/skills/index.js');
    const { buildKit, listTools, listSkills } = await import('../src/registry/index.js');

    for (const ref of ['read', 'write', 'edit', 'bash', 'expose_port', 'webfetch', 'websearch', 'browser']) {
      expect(listTools()).toContain(ref);
    }
    for (const ref of ['vite-react-app', 'visual-qa', 'web-research']) {
      expect(listSkills()).toContain(ref);
    }

    const kit = buildKit(
      ['read', 'write', 'edit', 'bash', 'expose_port', 'webfetch', 'websearch', 'browser'],
      ['vite-react-app', 'visual-qa']
    );
    expect(kit.tools).toHaveLength(8);
    const preamble = await kit.systemPreamble();
    expect(preamble).toContain('senior full-stack engineer'); // vite-react-app
    expect(preamble).toContain('Visual QA'); // visual-qa
  });
});
