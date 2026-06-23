// src/types/skill.ts
// A Skill is READ-ONLY instruction text — NOT a callable. Per KERNEL.md glossary:
// "Skill = read-only instruction text (side effects → it's a TOOL)". So a skill
// resolves to a string that the harness injects into its system prompt (or serves
// on demand). web search / playwright are NOT skills — they have side effects, so
// they live in the Tool seam (tool.ts). The "playwright skill" is the TEXT that
// teaches the agent how to use the browser TOOL.

export interface SkillSpec {
  readonly ref: string; // 'vite-react-app' | 'visual-qa' | 'web-research' …
  readonly description: string;
  // Resolved lazily so a skill could read a file / fetch a fragment later. Today
  // they return inline markdown.
  instructions(): Promise<string> | string;
}
