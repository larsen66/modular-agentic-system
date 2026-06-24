# `src/app` — App shell layer (top)

The global frame of the island, broken into clear submodules (not loose files). Knows that every
surface exists; owns providers, routing, and global chrome.

```
app/
├── providers/          # one file per global provider, composed in index
│   ├── index.tsx       #   <AppProviders> — composes all providers in order
│   ├── QueryProvider.tsx    # island-owned react-query client
│   ├── ThemeProvider.tsx    # applies theme to <html>
│   └── I18nProvider.tsx     # localization bootstrap (placeholder until i18n is wired)
├── router/
│   ├── index.tsx       #   <IslandRouter> — RouterProvider
│   └── routes.tsx      #   declarative route table; surfaces register routes here
└── shell/
    └── AppShell.tsx    #   outer layout frame (surface chrome added later as features)
```

`src/App.tsx` composes `<AppProviders>` + `<IslandRouter>`. Add a global provider by creating its
file in `providers/` and slotting it into `providers/index.tsx`.

**May import from:** `features/`, `shared/`, `core/`, `state/`, `pages/`, `i18n/`.
**Dependency direction:** down only. Nothing imports from `app/`.
