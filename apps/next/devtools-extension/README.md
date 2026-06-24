# Agent Stream Inspector (DevTools extension)

A Chrome/Edge DevTools panel that logs **everything from the agent** on the chat page —
every kernel `EngineEvent` (`run_started`, `stream_chunk`, `tool_call`, `tool_result`,
`final_text`, `usage_delta`, `log`, `preview_ready`, `terminal`, `settled`) plus the
`/message` request body and stream start/end/error boundaries.

It reads the raw frames **before** they're translated for the UI, so you see exactly what the
kernel emits.

## How it works

`apps/next/src/core/kernel.ts` taps `streamKernelMessage` (the single SSE chokepoint) and pushes
each record into a ring buffer, then exposes it on the page as `window.__AGENT_INSPECTOR__`. This
DevTools panel polls that bridge via `chrome.devtools.inspectedWindow.eval` and renders the records.
No content script, no network parsing — just the structured frames.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder:
   `apps/next/devtools-extension/`.
4. Open the app page (e.g. `http://localhost:8081/project/.../chat/...`).
5. Open DevTools (F12) → **Agent Stream** tab.
6. Send a message in the chat — frames stream into the panel live.

## Panel controls

- **Click a row** to expand the full JSON payload.
- **filter** — substring match on the event name or the payload JSON.
- **pause / resume** — stop/start polling the page (records keep accumulating in the page ring).
- **↓ auto** — auto-scroll to newest (toggles off if you scroll up).
- **export** — download all visible records as `.jsonl`.
- **clear** — empty the page-side ring buffer.

## Optional: also mirror to the console

From the app you can stream the same records into the regular browser console:

```js
localStorage.setItem('kernel-inspector-console', '1') // then reload
```

Set it back to `''` / remove the key to stop.

## Notes

- The ring buffer keeps the last 1000 records (see `INSPECTOR_RING_MAX` in `core/kernel.ts`).
- On a page reload the panel auto-resyncs (it detects the seq counter resetting).
- The bridge is installed whenever `core/kernel.ts` loads, in any build. If you want it gated to
  dev only, wrap the `window.__AGENT_INSPECTOR__ = …` assignment in `import.meta.env.DEV`.
