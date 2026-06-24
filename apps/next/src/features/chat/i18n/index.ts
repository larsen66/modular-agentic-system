import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n'
import { useUiStore } from '@/state/uiStore'
import { en, type ChatStrings } from './en'
import { de } from './de'

// Modular i18n accessor for the chat namespace — mirrors the shell pattern: strings resolve by the
// active language held in the cross-cutting UI store; the per-feature {en,de} maps are the source
// of truth.
const STRINGS: Record<LanguageCode, ChatStrings> = { en, de }

export function chatStrings(lang: LanguageCode = DEFAULT_LANGUAGE): ChatStrings {
  return STRINGS[lang] ?? en
}

/** Hook form — returns the chat strings for the active language. */
export function useChatStrings(): ChatStrings {
  const lang = useUiStore((s) => s.language)
  return chatStrings(lang)
}

export type { ChatStrings }
