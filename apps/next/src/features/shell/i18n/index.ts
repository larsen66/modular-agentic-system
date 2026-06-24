import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n'
import { useUiStore } from '@/state/uiStore'
import { en, type ShellStrings } from './en'
import { de } from './de'

// Modular i18n accessor for the shell namespace. Strings resolve by the active language held in
// the cross-cutting UI store (set from the profile language selector); the per-feature {en,de}
// maps are the source of truth. (When the react-i18next engine lands in src/i18n, this stays the
// shell's string surface.)
const STRINGS: Record<LanguageCode, ShellStrings> = { en, de }

export function shellStrings(lang: LanguageCode = DEFAULT_LANGUAGE): ShellStrings {
  return STRINGS[lang] ?? en
}

/** Hook form — returns the shell strings for the active language. */
export function useShellStrings(): ShellStrings {
  const lang = useUiStore((s) => s.language)
  return shellStrings(lang)
}

export type { ShellStrings }
