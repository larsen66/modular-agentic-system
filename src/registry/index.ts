// src/registry/index.ts
// The two seams. Append-only; one module = one self-registering directory;
// resolution is by ref string ONLY, never a direct import from Core or another
// adapter. The registry is a plain module-scoped Map — NOT a
// globalThis[Symbol.for(...)] singleton (avoids the parallel-isolation footgun).
// Optionally injectable for tests via createRegistry().

import type { Harness, Environment, ToolSpec, SkillSpec, ToolKit } from '../types/index.js';

export class UnknownRefError extends Error {
  constructor(seam: 'harness' | 'environment' | 'tool' | 'skill', ref: string, known: string[]) {
    super(`Unknown ${seam} ref "${ref}". Known: [${known.join(', ')}]`);
    this.name = 'UnknownRefError';
  }
}

export interface Registry {
  registerHarness(ref: string, factory: () => Harness): void;
  registerEnvironment(ref: string, factory: () => Environment): void;
  resolveHarness(ref: string): Harness;
  resolveEnvironment(ref: string): Environment;
  listHarnesses(): string[];
  listEnvironments(): string[];
  // Tool + Skill seams (same shape as the two above: append-only, ref-resolved).
  registerTool(ref: string, factory: () => ToolSpec): void;
  registerSkill(ref: string, factory: () => SkillSpec): void;
  resolveTools(refs: string[]): ToolSpec[];
  resolveSkills(refs: string[]): SkillSpec[];
  listTools(): string[];
  listSkills(): string[];
  // Resolve a per-run bundle. `toolRefs`/`skillRefs` are the EXTERNAL refs to
  // resolve (unknown ones throw — fail fast on a typo). `nativeToolRefs`/
  // `nativeSkillRefs` are passed through verbatim onto the kit so the harness
  // knows which refs it owns; they are NOT resolved here.
  buildKit(
    toolRefs: string[],
    skillRefs: string[],
    nativeToolRefs?: string[],
    nativeSkillRefs?: string[]
  ): ToolKit;
}

export function createRegistry(): Registry {
  const harnesses = new Map<string, () => Harness>();
  const environments = new Map<string, () => Environment>();
  const tools = new Map<string, () => ToolSpec>();
  const skills = new Map<string, () => SkillSpec>();

  const self: Registry = {
    registerHarness(ref, factory) {
      if (harnesses.has(ref)) {
        throw new Error(`Harness ref "${ref}" already registered (registries are append-only).`);
      }
      harnesses.set(ref, factory);
    },
    registerEnvironment(ref, factory) {
      if (environments.has(ref)) {
        throw new Error(`Environment ref "${ref}" already registered (registries are append-only).`);
      }
      environments.set(ref, factory);
    },
    resolveHarness(ref) {
      const factory = harnesses.get(ref);
      if (!factory) throw new UnknownRefError('harness', ref, [...harnesses.keys()]);
      return factory();
    },
    resolveEnvironment(ref) {
      const factory = environments.get(ref);
      if (!factory) throw new UnknownRefError('environment', ref, [...environments.keys()]);
      return factory();
    },
    listHarnesses() {
      return [...harnesses.keys()];
    },
    listEnvironments() {
      return [...environments.keys()];
    },
    registerTool(ref, factory) {
      if (tools.has(ref)) {
        throw new Error(`Tool ref "${ref}" already registered (registries are append-only).`);
      }
      tools.set(ref, factory);
    },
    registerSkill(ref, factory) {
      if (skills.has(ref)) {
        throw new Error(`Skill ref "${ref}" already registered (registries are append-only).`);
      }
      skills.set(ref, factory);
    },
    resolveTools(refs) {
      return refs.map((ref) => {
        const factory = tools.get(ref);
        if (!factory) throw new UnknownRefError('tool', ref, [...tools.keys()]);
        return factory();
      });
    },
    resolveSkills(refs) {
      return refs.map((ref) => {
        const factory = skills.get(ref);
        if (!factory) throw new UnknownRefError('skill', ref, [...skills.keys()]);
        return factory();
      });
    },
    listTools() {
      return [...tools.keys()];
    },
    listSkills() {
      return [...skills.keys()];
    },
    buildKit(toolRefs, skillRefs, nativeToolRefs = [], nativeSkillRefs = []) {
      const resolvedTools = self.resolveTools(toolRefs);
      const resolvedSkills = self.resolveSkills(skillRefs);
      const byRef = new Map(resolvedTools.map((t) => [t.ref, t]));
      return {
        tools: resolvedTools,
        skills: resolvedSkills,
        nativeToolRefs,
        nativeSkillRefs,
        byRef: (ref) => byRef.get(ref),
        async systemPreamble(base) {
          const parts = base ? [base] : [];
          for (const skill of resolvedSkills) parts.push(await skill.instructions());
          return parts.join('\n\n---\n\n');
        },
      };
    },
  };

  return self;
}

// The default, process-wide registry instance the adapters self-register into.
export const registry: Registry = createRegistry();

// Convenience free functions bound to the default registry (the SPEC §1.4 API).
export const registerHarness = (ref: string, factory: () => Harness): void =>
  registry.registerHarness(ref, factory);
export const registerEnvironment = (ref: string, factory: () => Environment): void =>
  registry.registerEnvironment(ref, factory);
export const resolveHarness = (ref: string): Harness => registry.resolveHarness(ref);
export const resolveEnvironment = (ref: string): Environment => registry.resolveEnvironment(ref);
export const listHarnesses = (): string[] => registry.listHarnesses();
export const listEnvironments = (): string[] => registry.listEnvironments();

export const registerTool = (ref: string, factory: () => ToolSpec): void =>
  registry.registerTool(ref, factory);
export const registerSkill = (ref: string, factory: () => SkillSpec): void =>
  registry.registerSkill(ref, factory);
export const buildKit = (
  toolRefs: string[],
  skillRefs: string[],
  nativeToolRefs?: string[],
  nativeSkillRefs?: string[]
): ToolKit => registry.buildKit(toolRefs, skillRefs, nativeToolRefs, nativeSkillRefs);
export const listTools = (): string[] => registry.listTools();
export const listSkills = (): string[] => registry.listSkills();
