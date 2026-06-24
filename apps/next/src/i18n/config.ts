// Island localization config — pure constants, no runtime deps (safe to import anywhere).
// EN + DE to start: English is the fallback/default, German is the gated parity locale.
export const SUPPORTED_LANGUAGES = ['en', 'de'] as const
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export function isSupportedLanguage(code: string): code is LanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
}
