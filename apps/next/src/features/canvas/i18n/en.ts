// Canvas surface strings — English (default/fallback). Modular i18n: this namespace is owned by the
// canvas feature, not a central catalog (ARCHITECTURE §3). DE parity lives in ./de.ts (gated by the
// i18n parity test). These are the preview/canvas chrome + state labels; the preview-tab strings that
// previously lived under the chat namespace (`chat/i18n preview.*`) move here as the canvas area lands.
export const en = {
  tabs: {
    preview: 'Preview',
    diff: 'Diff',
    graph: 'Graph',
    history: 'History',
    add: 'Open…',
    openFile: 'Open file',
    expand: 'Expand',
    collapse: 'Collapse',
    hidePanel: 'Hide panel',
    close: 'Close tab',
  },
  toolbar: {
    routes: 'Routes',
    reload: 'Reload',
    openExternal: 'Open in new tab',
    share: 'Share & Publish',
    address: 'Address',
    addressPlaceholder: 'Enter a URL',
    actions: 'More actions',
    viewport: { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' },
  },
  handoff: 'Updating preview…',
  // Provisioning launch-diagnostic (coarse stages from deriveStage).
  stage: {
    creating: 'Creating your workspace…',
    installing: 'Installing dependencies…',
    building: 'Building your app…',
    ready: 'Ready',
    recovering: 'Recovering the session…',
    error: 'Could not start the preview.',
  },
  // The degraded / empty states (one DegradedStatePanel per row).
  states: {
    noSession: {
      title: 'No preview yet',
      description: 'Start a chat and the live preview will appear here.',
    },
    evicted: {
      title: 'This session ended',
      description: 'The workspace was reclaimed while idle. Start a new chat to continue.',
      action: 'Start new chat',
    },
    routerUpgrade: {
      title: 'Preview needs HashRouter',
      description: 'This app uses BrowserRouter, which the preview proxy can’t serve. Switch it to HashRouter.',
      action: 'Learn more',
    },
    containerDead: {
      title: 'Session ended',
      description: 'The preview container is no longer running.',
      action: 'Restart',
    },
    error: {
      title: 'Something went wrong',
      description: 'The preview couldn’t be loaded.',
      action: 'Retry',
      restart: 'Restart',
    },
  },
  close: 'Close preview',
  resize: 'Resize preview',
  // The greenfield app-structure graph view (canvas `graph` screen).
  graph: {
    toolbar: {
      layout: 'Layout',
      filter: 'Filter node kinds',
      search: 'Search nodes',
      searchPlaceholder: 'Search nodes…',
      fit: 'Fit to view',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomReset: 'Reset zoom',
    },
    layouts: {
      hierarchical: 'Hierarchical',
      force: 'Force',
      radial: 'Radial',
    },
    kinds: {
      app: 'App',
      folder: 'Folder',
      chat: 'Chat',
      'mounted-app': 'Mounted app',
    },
    counts: {
      nodes: (n: number) => `${n} node${n === 1 ? '' : 's'}`,
      edges: (n: number) => `${n} edge${n === 1 ? '' : 's'}`,
    },
    stale: 'May be out of date',
    legend: {
      title: 'Legend',
      edgesContains: 'Edges show containment (contains).',
      edgesImports: 'Edges show imports between files.',
    },
    detail: {
      kind: 'Kind',
      path: 'Path',
      noPath: 'No file path for this node.',
      inDegree: (n: number) => `${n} incoming`,
      outDegree: (n: number) => `${n} outgoing`,
      openFile: 'Open file',
      close: 'Close',
    },
    states: {
      loading: 'Mapping your app…',
      noSession: {
        title: 'No app to map yet',
        description: 'Select an app and its structure will appear here.',
      },
      empty: {
        title: 'Nothing to map yet',
        description: 'Start a chat to build your app — its structure will show up here.',
        action: 'Refresh',
      },
      error: {
        title: 'Couldn’t build the graph',
        description: 'The app structure couldn’t be loaded.',
        action: 'Retry',
      },
    },
  },
  // The file-reader view (canvas `file-reader` screen).
  fileReader: {
    loading: 'Loading {name}…',
    readFailed: 'Couldn’t read this file.',
    empty: 'This file is empty.',
    noRows: 'No rows to show.',
    truncated: 'Showing the first {n} rows.',
    columnPrefix: 'Column',
    tableLabel: 'File contents',
    tableView: 'Table',
    rawView: 'Raw',
    viewToggle: 'Toggle table / raw view',
    edit: 'Edit',
    editTip: 'Edit this file and save changes back to the workspace.',
    save: 'Save',
    saving: 'Saving…',
    saveFailed: 'Couldn’t save your changes.',
    cancel: 'Cancel',
    dismiss: 'Dismiss',
    updated: 'Updated',
    noSession: { title: 'No file open', description: 'Open a file from the app to view it here.' },
  },
  // The run/version history view (canvas `history` screen).
  history: {
    runLabel: 'Run',
    timelineLabel: 'Run history',
    status: { started: 'Started', running: 'Running', succeeded: 'Succeeded', failed: 'Failed' },
    bucket: { completed: 'Applied', in_progress: 'In OPS', rejected: 'Rejected', notStarted: 'No proposal' },
    filesSummary: (n: number, a: number, d: number) => `${n} files · +${a} −${d}`,
    empty: { title: 'No history yet', description: 'Runs appear here after the agent makes changes.' },
    error: { title: 'Could not load history', description: 'We couldn’t load this app’s run history.', action: 'Retry' },
    noSession: { title: 'No app selected', description: 'Open an app to see its run history.' },
    honesty: {
      title: 'Nothing is applied or rolled back here',
      description: 'This view only shows history. Apply and rollback are governed actions in OPS.',
    },
    actions: { viewDiff: 'View diff', openInOps: 'Open in OPS' },
    detail: {
      title: 'Run detail',
      metaLine: (time: string, model: string) => `${time} · ${model}`,
      unknownModel: 'Unknown model',
      session: 'Session',
      filesTable: 'Files changed',
      colFile: 'File',
      colAdds: 'Added',
      colDels: 'Removed',
      noFiles: 'No files changed in this run.',
      emptyHint: { title: 'Select a run', description: 'Pick a run from the timeline to see its detail.' },
    },
  },
  // The embedded L1 tool view (canvas `child-app-mount` screen).
  childMount: {
    iframeTitle: 'Embedded tool',
    loading: {
      'loading-node': 'Loading…',
      'attaching-runner': 'Starting the tool…',
      handshaking: 'Connecting…',
    },
    errors: {
      reload: 'Reload',
      noSuchApp: { title: 'Tool not found', description: 'This embedded tool could not be located.' },
      misconfigured: { title: 'Tool misconfigured', description: 'This tool’s mount is not set up correctly.' },
      noSession: { title: 'Couldn’t start the tool', description: 'The tool session could not be created.' },
      failed: { title: 'Tool didn’t respond', description: 'The embedded tool failed to connect. Try reloading.' },
    },
  },
}

export type CanvasStrings = typeof en
