# `src/i18n` — Localization engine (global wiring only)

This folder wires the i18n **engine and language switching**. It holds **no application strings**.
Strings are owned per-feature (see below). EN (default/fallback) + DE (gated parity) to start.

> Scaffold status: structure + conventions only. The runtime (`react-i18next`) is NOT installed
> yet — `config.ts` is live (pure constants); `index.ts` re-exports it and documents the wiring
> to add when the first feature ships strings. This keeps the build dep-free until needed.

## Modular ownership model (improves on a central catalog)

- **Global `src/i18n/`** — engine init, supported languages, the typed `t`, and a
  `registerNamespace()` helper. Active language is read from `src/state/uiStore`.
- **Per-feature strings** — each surface owns `features/<surface>/i18n/`:
  ```
  features/<surface>/i18n/
  ├── en.ts        # typed string map for this surface's namespace
  ├── de.ts        # same keys, German
  └── index.ts     # registers the namespace on import
  ```
  The feature imports its own namespace; nothing else reaches into it. A surface's strings are
  added/removed WITH the surface — no orphan keys, no mega-file merge conflicts.

## Rules

- No app strings in `src/i18n/` — only engine/config.
- Keys are typed so a missing translation is a compile error, not a silent runtime fallback.
- EN and DE keys must stay in parity per feature namespace (parity is gated).

## To wire the engine (when first needed)

1. `npm i react-i18next i18next` in `apps/next`.
2. Implement `index.ts`: init i18next (`fallbackLng: 'en'`, `supportedLngs: SUPPORTED_LANGUAGES`),
   export `t` and `registerNamespace`.
3. Replace the placeholder `app/providers/I18nProvider.tsx` passthrough with real init + bind the
   active language to `uiStore`.
