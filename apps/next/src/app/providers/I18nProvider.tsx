import type { ReactNode } from 'react'

// Localization provider — PLACEHOLDER (scaffold: structure + conventions only).
//
// The i18n engine (react-i18next) is intentionally NOT installed/wired yet. It is wired in
// src/i18n/index.ts when the first feature ships a translation namespace. Localization is
// MODULAR: each feature owns its strings in features/<surface>/i18n/{en,de} and registers that
// namespace on load — there is no central locale catalog (see src/i18n/README.md).
//
// Today this is a passthrough so the scaffold builds without the runtime. When wired, this
// provider initializes the engine and exposes the active language from src/state/uiStore.
export function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
