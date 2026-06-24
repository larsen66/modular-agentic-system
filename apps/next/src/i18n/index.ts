// Island i18n entry. Currently re-exports config only (structure + conventions scaffold).
//
// When the first feature ships a translation namespace, the engine is wired HERE:
//   - init react-i18next with `fallbackLng: 'en'`, `supportedLngs: SUPPORTED_LANGUAGES`
//   - expose a typed `t` and a `registerNamespace(ns, { en, de })` used by feature modules
//   - drive the active language from src/state/uiStore (lang lives in cross-cutting UI state)
//
// Localization is MODULAR: there is no central locale catalog. Each feature owns its strings in
// features/<surface>/i18n/{en,de} and registers its namespace on load. See README.md.
export * from './config'
