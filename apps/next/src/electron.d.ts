// Type declarations for the contextBridge API exposed by electron/preload.ts.
// window.electron is only defined when running inside Electron (injected by the preload).
// Guard all access with `window.electron?.isElectron` — it is undefined in the web browser.

interface ElectronBridge {
  readonly isElectron: true
  /** Subscribe to bos:// deep-link URLs. Returns an unsubscribe function. */
  onDeepLink(cb: (url: string) => void): () => void
}

interface Window {
  electron?: ElectronBridge
}
