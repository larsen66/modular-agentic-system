import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n'
import { useUiStore } from '@/state/uiStore'
import { en, type CanvasStrings } from './en'
import { de } from './de'

// Modular i18n accessor for the canvas namespace — mirrors the shell/chat pattern: strings resolve by
// the active language held in the cross-cutting UI store; the per-feature {en,de} maps are the SSOT.
const STRINGS: Record<LanguageCode, CanvasStrings> = { en, de }

export function canvasStrings(lang: LanguageCode = DEFAULT_LANGUAGE): CanvasStrings {
  return STRINGS[lang] ?? en
}

/** Hook form — returns the canvas strings for the active language. */
export function useCanvasStrings(): CanvasStrings {
  const lang = useUiStore((s) => s.language)
  return canvasStrings(lang)
}

export type { CanvasStrings }
