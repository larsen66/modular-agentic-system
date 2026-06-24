import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n'
import { useUiStore } from '@/state/uiStore'
import { en, type AuthStrings } from './en'
import { de } from './de'

// Modular i18n accessor for the `auth` namespace — mirrors the shell's pattern. Strings resolve by
// the active language in the cross-cutting UI store; the per-feature {en,de} maps are the source of
// truth.
const STRINGS: Record<LanguageCode, AuthStrings> = { en, de }

export function authStrings(lang: LanguageCode = DEFAULT_LANGUAGE): AuthStrings {
  return STRINGS[lang] ?? en
}

/** Hook form — returns the auth strings for the active language. */
export function useAuthStrings(): AuthStrings {
  const lang = useUiStore((s) => s.language)
  return authStrings(lang)
}

/** Interpolate `{name}` placeholders in a string with the given values. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

export type { AuthStrings }
