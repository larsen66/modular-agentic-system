// studio/src/ActivityLog.tsx
// The enriched Activity Log: a debuggable, filterable, searchable view over a
// run's full EngineEvent stream — for the LIVE run and for any past run replayed
// from the server's history store. Additive over the old line-only panel: it now
// renders EVERY EngineEvent (not just `log`), with per-event timestamps + deltas,
// kind/harness/env filters, free-text search, error/terminal highlighting,
// collapsible tool args, a per-event raw-JSON toggle, copy/export, and a run
// metadata header.

import { useMemo, useState, useEffect } from 'react';
import {
  Tag,
  Search,
  Checkbox,
  Button,
  Tooltip,
  InlineNotification,
} from '@carbon/react';
import { Copy, Download, Renew } from '@carbon/icons-react';
import type { EngineEvent, RunListItem, PersistedRun } from './sse';
import { fetchHistory, fetchRun } from './sse';

// One recorded event with the wall-clock time it was observed. The live run
// stamps `at` as events arrive; a replayed run reuses the persisted `log.at`
// when present, else falls back to evenly-derived ordering.
export interface EventRecord {
  ev: EngineEvent;
  at: number;
  seq: number;
}

// The metadata header model — shared by live and replayed runs.
export interface RunHeader {
  runId: string | null;
  harnessRef: string;
  envRef: string;
  model: string | null;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number | null;
  terminalCause: string | null;
  sandboxId: string | null;
  previewUrl: string | null;
}

// All EngineEvent kinds we let the user filter on. `child_*` are folded under
// their own toggles only if they appear, so we keep the list lean here.
const KIND_LABELS: Record<string, string> = {
  stream_chunk: 'stream',
  tool_call: 'tool_call',
  tool_result: 'tool_result',
  preview_ready: 'preview',
  usage_delta: 'usage',
  final_text: 'final_text',
  log: 'log',
  terminal: 'terminal',
  child_started: 'child_started',
  child_settled: 'child_settled',
};

interface ActivityLogProps {
  // The live run's records + header (App owns these; updated as SSE streams).
  liveRecords: EventRecord[];
  liveHeader: RunHeader | null;
  running: boolean;
  // Bumped by App on login/logout so the history panel re-fetches under the new
  // identity (the list is RLS-scoped server-side — a different user, a different
  // set of rows). Also gates fetching: 0 = logged out, show nothing.
  authVersion: number;
}

// Extract a human one-line summary for an event row.
function eventSummary(ev: EngineEvent): string {
  switch (ev.type) {
    case 'stream_chunk':
      return ev.text;
    case 'final_text':
      return ev.text;
    case 'tool_call':
      return `${ev.name}(${argsPreview(ev.args)})`;
    case 'tool_result':
      return `ok=${ev.ok}${ev.output ? ' · ' + ev.output : ''}`;
    case 'usage_delta':
      return `in=${ev.inputTokens} out=${ev.outputTokens}`;
    case 'preview_ready':
      return `${ev.url} (port ${ev.port})`;
    case 'log':
      return `[${ev.category}] ${ev.message}`;
    case 'terminal':
      return `cause=${ev.cause}${ev.error ? ' · ' + ev.error.code + ': ' + ev.error.message : ''}`;
    default:
      // Any event kind not specially summarized (e.g. child_* from a future
      // harness) falls back to its raw JSON.
      return JSON.stringify(ev);
  }
}

function argsPreview(args: unknown): string {
  if (args === undefined) return '';
  const s = typeof args === 'string' ? args : JSON.stringify(args);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}

// The big/collapsible payload (tool args, full output, raw json source).
function eventDetail(ev: EngineEvent): string | null {
  if (ev.type === 'tool_call' && ev.args !== undefined) {
    return typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
  }
  if (ev.type === 'tool_result' && ev.output && ev.output.length > 80) {
    return ev.output;
  }
  return null;
}

// Severity → CSS class for highlighting. error/terminal-error are loud.
function severityClass(ev: EngineEvent): string {
  if (ev.type === 'terminal') {
    return ev.cause === 'error' ? 'sev-error' : ev.cause === 'cancelled' ? 'sev-warn' : 'sev-ok';
  }
  if (ev.type === 'log') return `sev-${ev.level === 'error' ? 'error' : ev.level === 'warn' ? 'warn' : 'info'}`;
  if (ev.type === 'tool_result' && !ev.ok) return 'sev-error';
  return 'sev-info';
}

function fmtTime(at: number): string {
  const d = new Date(at);
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function fmtDelta(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API unavailable (insecure context) — fall back to a textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* nothing else to do */
    }
    document.body.removeChild(ta);
  }
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLog({ liveRecords, liveHeader, running, authVersion }: ActivityLogProps) {
  // Mode: 'live' shows the in-flight run; 'replay' shows a past run loaded from
  // /history/:runId. Selecting a history row flips to replay; "Live" returns.
  const [mode, setMode] = useState<'live' | 'replay'>('live');
  const [history, setHistory] = useState<RunListItem[]>([]);
  const [replayRun, setReplayRun] = useState<PersistedRun | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Debug controls.
  const [search, setSearch] = useState('');
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [rawMode, setRawMode] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [copiedNote, setCopiedNote] = useState(false);

  // A run is the live one OR the replayed one. Derive records + header uniformly.
  const records: EventRecord[] = useMemo(() => {
    if (mode === 'replay' && replayRun) {
      // Persisted run_events: each row's `.data` is the original EngineEvent,
      // ordered by `.seq`. Use the row timestamp (or log.at) for the timeline.
      return replayRun.events.map((row, i) => {
        const ev = row.data;
        const at = ev.type === 'log' ? ev.at : new Date(row.ts).getTime();
        return { ev, at, seq: i };
      });
    }
    return liveRecords;
  }, [mode, replayRun, liveRecords]);

  const header: RunHeader | null = useMemo(() => {
    if (mode === 'replay' && replayRun) {
      const r = replayRun.run;
      const usage = r.summary?.usage ?? {};
      // The view doesn't project harness/env/prompt (prod runs carry them in
      // admission/summary, not surfaced here). Show what the RLS row gives;
      // terminalCause derives from status.
      return {
        runId: r.id,
        harnessRef: r.provider ?? '—',
        envRef: r.session_id ? `session ${r.session_id.slice(0, 8)}` : '—',
        model: r.model,
        prompt: r.summary?.finalText ?? '',
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cost: r.summary?.cost ?? 0,
        durationMs: r.duration_ms,
        terminalCause: r.summary?.cause ?? (r.status === 'succeeded' ? 'done' : r.status === 'failed' ? 'error' : null),
        sandboxId: null,
        previewUrl: null,
      };
    }
    return liveHeader;
  }, [mode, replayRun, liveHeader]);

  // Which event kinds actually appear (drives the filter toggle list).
  const presentKinds = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) set.add(r.ev.type);
    return [...set];
  }, [records]);

  const refreshHistory = async () => {
    if (authVersion === 0) {
      setHistory([]);
      return;
    }
    setHistory(await fetchHistory());
  };

  // (Re)load history when the identity changes (login/logout) and whenever a
  // live run settles. authVersion=0 means logged out → empty.
  useEffect(() => {
    void refreshHistory();
    // Leaving replay when identity changes avoids showing another user's run.
    setReplayRun(null);
    setMode('live');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authVersion]);
  useEffect(() => {
    if (!running) void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const openRun = async (runId: string) => {
    const run = await fetchRun(runId);
    if (run) {
      setReplayRun(run);
      setMode('replay');
      setExpanded(new Set());
    }
  };

  const goLive = () => {
    setMode('live');
    setReplayRun(null);
    setExpanded(new Set());
  };

  const searchLower = search.trim().toLowerCase();
  const visible = records.filter((r) => {
    if (hiddenKinds.has(r.ev.type)) return false;
    if (!searchLower) return true;
    const hay = (eventSummary(r.ev) + ' ' + (eventDetail(r.ev) ?? '') + ' ' + r.ev.type).toLowerCase();
    return hay.includes(searchLower);
  });

  const toggleKind = (kind: string) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const toggleExpand = (seq: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  const copyOne = async (r: EventRecord) => {
    await copyText(JSON.stringify(r.ev, null, 2));
    flashCopied();
  };

  const copyWholeRun = async () => {
    await copyText(JSON.stringify(records.map((r) => r.ev), null, 2));
    flashCopied();
  };

  const exportRun = () => {
    const id = header?.runId ?? 'live';
    downloadJson(`run-${id}.json`, {
      metadata: header,
      events: records.map((r) => r.ev),
    });
  };

  const flashCopied = () => {
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 1200);
  };

  return (
    <section className="activity-log">
      <div className="activity-bar">
        <span>Activity Log</span>
        <Tag type={mode === 'live' ? 'green' : 'purple'} size="sm">
          {mode === 'live' ? (running ? 'live · running' : 'live') : 'replay'}
        </Tag>
        <Tag type="gray" size="sm">
          {visible.length}/{records.length} events
        </Tag>
        {mode === 'replay' && (
          <Button size="sm" kind="ghost" onClick={goLive}>
            ← Back to live
          </Button>
        )}
        <div className="activity-bar-spacer" />
        <Button
          size="sm"
          kind="ghost"
          renderIcon={Copy}
          onClick={copyWholeRun}
          disabled={records.length === 0}
        >
          Copy run
        </Button>
        <Button
          size="sm"
          kind="ghost"
          renderIcon={Download}
          onClick={exportRun}
          disabled={records.length === 0}
        >
          Export JSON
        </Button>
        <Button
          size="sm"
          kind="ghost"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          {historyOpen ? 'Hide history' : `History (${history.length})`}
        </Button>
      </div>

      {copiedNote && (
        <InlineNotification
          lowContrast
          kind="success"
          title="Copied"
          hideCloseButton
          className="activity-copied"
        />
      )}

      {/* Run metadata header. */}
      {header && (
        <div className="activity-meta">
          <span><strong>harness</strong> {header.harnessRef}</span>
          <span><strong>env</strong> {header.envRef}</span>
          {header.model && <span><strong>model</strong> {header.model}</span>}
          <span><strong>tokens</strong> in {header.inputTokens} / out {header.outputTokens}</span>
          <span><strong>cost</strong> ${header.cost}</span>
          {header.durationMs != null && <span><strong>dur</strong> {header.durationMs}ms</span>}
          {header.terminalCause && (
            <span className={header.terminalCause === 'error' ? 'meta-err' : ''}>
              <strong>cause</strong> {header.terminalCause}
            </span>
          )}
          {header.sandboxId && <span><strong>sandbox</strong> {header.sandboxId}</span>}
          {header.previewUrl && <span><strong>preview</strong> {header.previewUrl}</span>}
          {header.runId && <span className="meta-runid"><strong>run</strong> {header.runId.slice(0, 8)}</span>}
        </div>
      )}

      <div className="activity-body">
        {/* History sidebar: past runs, newest first. */}
        {historyOpen && (
          <div className="activity-history">
            <div className="activity-history-head">
              <span>Past runs</span>
              <Button
                hasIconOnly
                size="sm"
                kind="ghost"
                iconDescription="Refresh"
                renderIcon={Renew}
                onClick={refreshHistory}
              />
            </div>
            {history.length === 0 ? (
              <div className="activity-empty">No past runs yet.</div>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  className={`history-row ${replayRun?.run.id === h.id ? 'history-row-active' : ''}`}
                  onClick={() => openRun(h.id)}
                  title={`run ${h.id}`}
                >
                  <div className="history-row-top">
                    <span className="history-hxe">
                      {h.collaborator_display_name ?? 'me'}
                      {h.owned_by_other_user_id ? ' (shared)' : ''}
                    </span>
                    <span className={`history-cause cause-${h.status}`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="history-row-mid">run {h.id.slice(0, 8)} · {h.model ?? 'no model'}</div>
                  <div className="history-row-bot">
                    <span>{h.duration_ms != null ? `${h.duration_ms}ms` : '—'}</span>
                    <span>{h.session_id ? h.session_id.slice(0, 8) : '—'}</span>
                    <span>{new Date(h.started_at).toLocaleTimeString('en-US', { hour12: false })}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Main stream column. */}
        <div className="activity-stream-col">
          {/* Controls row: search + raw toggle + kind filters. */}
          <div className="activity-controls">
            <Search
              size="sm"
              labelText="Search events"
              placeholder="Search event text / tool args…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              closeButtonLabelText="Clear"
            />
            <Checkbox
              id="raw-toggle"
              labelText="Raw JSON"
              checked={rawMode}
              onChange={(_, { checked }) => setRawMode(checked)}
            />
          </div>
          <div className="activity-filters">
            {presentKinds.map((k) => (
              <button
                key={k}
                className={`kind-chip ${hiddenKinds.has(k) ? 'kind-off' : `kind-${k}`}`}
                onClick={() => toggleKind(k)}
                title={hiddenKinds.has(k) ? 'Click to show' : 'Click to hide'}
              >
                {KIND_LABELS[k] ?? k}
              </button>
            ))}
          </div>

          <div className="activity-lines">
            {records.length === 0 ? (
              <div className="activity-empty">
                Kernel, environment, and harness lifecycle stream here. Run a prompt
                or open a past run from the history panel.
              </div>
            ) : visible.length === 0 ? (
              <div className="activity-empty">No events match the current filter/search.</div>
            ) : (
              visible.map((r, i) => {
                const prev = i > 0 ? visible[i - 1] : null;
                const delta = prev ? r.at - prev.at : 0;
                const detail = eventDetail(r.ev);
                const isOpen = expanded.has(r.seq);
                return (
                  <div key={r.seq} className={`ev-row ${severityClass(r.ev)}`}>
                    <span className="ev-time" title={new Date(r.at).toISOString()}>
                      {fmtTime(r.at)}
                    </span>
                    <span className="ev-delta">{i > 0 ? fmtDelta(delta) : ''}</span>
                    <span className={`ev-kind ev-kind-${r.ev.type}`}>
                      {KIND_LABELS[r.ev.type] ?? r.ev.type}
                    </span>
                    <span className="ev-content">
                      {rawMode ? (
                        <pre className="ev-raw">{JSON.stringify(r.ev, null, 2)}</pre>
                      ) : (
                        <>
                          <span className="ev-summary">{eventSummary(r.ev)}</span>
                          {detail && (
                            <>
                              <button className="ev-toggle" onClick={() => toggleExpand(r.seq)}>
                                {isOpen ? 'collapse' : 'expand'}
                              </button>
                              {isOpen && <pre className="ev-detail">{detail}</pre>}
                            </>
                          )}
                        </>
                      )}
                    </span>
                    <Tooltip label="Copy event" align="left">
                      <button className="ev-copy" onClick={() => copyOne(r)} aria-label="Copy event">
                        <Copy size={14} />
                      </button>
                    </Tooltip>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
