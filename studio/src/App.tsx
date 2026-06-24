import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Theme,
  Button,
  Dropdown,
  TextArea,
  Tag,
  InlineLoading,
} from '@carbon/react';
import { Send, Renew, Application } from '@carbon/icons-react';
import {
  streamRun,
  fetchRegistry,
  login,
  fetchProjects,
  type EngineEvent,
  type AuthUser,
  type ProjectItem,
  type ExecutionTopology,
  type TopologyMatrix,
} from './sse';
import ActivityLog, { type EventRecord, type RunHeader } from './ActivityLog';
import ArchitectureFlow from './ArchitectureFlow';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  events: string[]; // event-type trace for this turn
}

const SESSION_PREFIX = 'studio-';
const DEFAULT_TEST_EMAIL = 'alice@local.test';
const DEFAULT_TEST_PASSWORD = 'password';
type StudioView = 'runner' | 'architecture';

function assistantMessageFromRecords(records: EventRecord[], fallbackId: string): ChatMessage {
  let text = '';
  const events: string[] = [];

  for (const { ev } of records) {
    if (ev.type === 'log') continue;
    events.push(ev.type);
    if (ev.type === 'stream_chunk') text += ev.text;
    else if (ev.type === 'final_text' && !text) text = ev.text;
    else if (ev.type === 'tool_call') text += `\n[tool: ${ev.name}]`;
  }

  return {
    id: fallbackId,
    role: 'assistant',
    text: text.trim() || 'No assistant text was recorded for this run.',
    events,
  };
}

function previewUrlFromRecords(records: EventRecord[]): string | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const ev = records[i]?.ev;
    if (ev?.type === 'preview_ready') return ev.url;
  }
  return null;
}

// Human labels for the execution-topology toggle.
const TOPOLOGY_LABEL: Record<ExecutionTopology, string> = {
  'agent-as-tool': 'Agent × sandbox-as-tool',
  'agent-in-sandbox': 'Agent inside sandbox',
};
const TOPOLOGY_BLURB: Record<ExecutionTopology, string> = {
  'agent-as-tool': 'Agent loop runs on the control plane; tool calls route OUT to the sandbox.',
  'agent-in-sandbox': 'Agent process runs INSIDE the sandbox, on its own disk.',
};

// Which topologies are runnable for a (harness, env) pair, given the matrix:
// agent-as-tool needs only exec() (any env); agent-in-sandbox needs the env to
// host an agent runtime. Mirrors src/kernel/capabilities.ts::resolveTopology.
function validTopologies(
  matrix: TopologyMatrix | null,
  harness: string,
  environment: string
): ExecutionTopology[] {
  const h = matrix?.harnesses.find((x) => x.ref === harness);
  if (!h) return [];
  const hosts = matrix?.environments.find((x) => x.ref === environment)?.hostsAgentRuntime ?? false;
  return h.topologies.filter((t) => (t === 'agent-in-sandbox' ? hosts : true));
}

function defaultTopologyFor(
  matrix: TopologyMatrix | null,
  harness: string,
  environment: string
): ExecutionTopology | null {
  const valid = validTopologies(matrix, harness, environment);
  if (valid.length === 0) return null;
  const declared = matrix?.harnesses.find((x) => x.ref === harness)?.defaultTopology;
  return declared && valid.includes(declared) ? declared : valid[0];
}

export default function App() {
  const [view, setView] = useState<StudioView>('runner');
  // ── auth + project scope (per-user isolation) ────────────────────────────
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authVersion, setAuthVersion] = useState(0); // 0 = logged out
  const [authError, setAuthError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [harnesses, setHarnesses] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);
  // Verified-ready (harness × environment) pairs from /registry, format
  // 'harnessRef x envRef'. Drives the cross-dropdown compatibility highlight.
  const [readyPairs, setReadyPairs] = useState<string[]>([]);
  // Per-harness topologies + per-env hostsAgentRuntime — drives the topology toggle.
  const [topologyMatrix, setTopologyMatrix] = useState<TopologyMatrix | null>(null);
  const [harness, setHarness] = useState('');
  const [environment, setEnvironment] = useState('');
  // The selected execution topology (agent-as-tool ↔ agent-in-sandbox), kept in
  // sync with what the current (harness, env) pair actually supports.
  const [topology, setTopology] = useState<ExecutionTopology | null>(null);
  const [prompt, setPrompt] = useState('Build a hello-world dev server');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Full EngineEvent records for the LIVE run (every event, with timestamps) +
  // the live run's metadata header. The ActivityLog component renders these and
  // additionally lets the user replay any persisted past run.
  const [liveRecords, setLiveRecords] = useState<EventRecord[]>([]);
  const [liveHeader, setLiveHeader] = useState<RunHeader | null>(null);
  const [defaultHint, setDefaultHint] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const runStartRef = useRef(0);
  const autoLoginStartedRef = useRef(false);
  const sessionRef = useRef(`${SESSION_PREFIX}${Date.now()}`);

  // Load the two registry listings to populate the dropdowns. This is the swap
  // surface: every registered adapter shows up here, selectable by ref string.
  // The backend also returns a recommended (harness, environment) default so the
  // user gets REAL generation with zero clicks (CLI login → real, no API key).
  useEffect(() => {
    fetchRegistry()
      .then((r) => {
        setHarnesses(r.harnesses);
        setEnvironments(r.environments);
        setReadyPairs(r.readyPairs ?? []);
        setTopologyMatrix(r.topologyMatrix ?? null);
        const d = r.defaults;
        const pickH = d && r.harnesses.includes(d.harness) ? d.harness : r.harnesses[0];
        const pickE = d && r.environments.includes(d.environment) ? d.environment : r.environments[0];
        if (pickH) setHarness(pickH);
        if (pickE) setEnvironment(pickE);
        if (d) setDefaultHint(d.reason);
      })
      .catch(() => {
        // Backend not up yet: leave adapter lists empty so the UI does not offer
        // stale refs that are not registered by the current source tree.
        setHarnesses([]);
        setEnvironments([]);
        setDefaultHint('Backend unavailable');
      });
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  // Log in through the runner (GoTrue proxy) with the fixed local test account,
  // then load that user's RLS-scoped projects. Bumping authVersion makes the
  // Activity Log re-fetch history under the default identity.
  const signInDefaultUser = useCallback(async () => {
    setAuthError(null);
    try {
      const user = await login(DEFAULT_TEST_EMAIL, DEFAULT_TEST_PASSWORD);
      setCurrentUser(user);
      setAuthVersion((v) => v + 1);
      const ps = await fetchProjects();
      setProjects(ps);
      setProjectId(ps[0]?.id ?? null);
    } catch {
      setAuthError('test account unavailable');
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    if (autoLoginStartedRef.current) return;
    autoLoginStartedRef.current = true;
    void signInDefaultUser();
  }, [signInDefaultUser]);

  // Compatibility model. `readyPairs` is the verified (harness × environment)
  // matrix; from it we derive, for the CURRENT selection in one dropdown, which
  // counterparts in the OTHER dropdown are compatible. When no matrix is loaded
  // (backend down) we treat everything as compatible so nothing looks broken.
  const compatSet = useMemo(() => new Set(readyPairs), [readyPairs]);
  const hasMatrix = readyPairs.length > 0;
  const isReadyPair = useCallback(
    (h: string, e: string) => !hasMatrix || compatSet.has(`${h} x ${e}`),
    [compatSet, hasMatrix]
  );
  // Environments compatible with the currently-selected harness, and harnesses
  // compatible with the currently-selected environment — for the captions.
  const envsForHarness = useMemo(
    () => environments.filter((e) => isReadyPair(harness, e)),
    [environments, harness, isReadyPair]
  );
  const harnessesForEnv = useMemo(
    () => harnesses.filter((h) => isReadyPair(h, environment)),
    [harnesses, environment, isReadyPair]
  );
  const currentPairReady = isReadyPair(harness, environment);

  // ── Topology toggle model ────────────────────────────────────────────────
  // Topologies the CURRENT (harness, env) pair can actually run. Recomputed when
  // either dropdown changes so the toggle never offers an impossible option.
  const availableTopologies = useMemo(
    () => validTopologies(topologyMatrix, harness, environment),
    [topologyMatrix, harness, environment]
  );
  // Keep the selection valid: preserve it if still available, else fall back to
  // the pair's default (the harness default when the env can host it).
  useEffect(() => {
    setTopology((cur) =>
      cur && availableTopologies.includes(cur)
        ? cur
        : defaultTopologyFor(topologyMatrix, harness, environment)
    );
  }, [availableTopologies, topologyMatrix, harness, environment]);
  const topologyItems = useMemo(
    () => availableTopologies.map((id) => ({ id, label: TOPOLOGY_LABEL[id] })),
    [availableTopologies]
  );
  const hasTopologyMatrix = Boolean(topologyMatrix);

  // Dropdown item models. `compatible` is relative to the OTHER dropdown's
  // current value, so selecting a harness re-flags the environment list and vice
  // versa. Carbon <Dropdown> renders these via itemToElement (custom listbox —
  // NOT a native <select>), so the highlight shows inside the open menu.
  const harnessItems = useMemo(
    () => harnesses.map((id) => ({ id, label: id, compatible: isReadyPair(id, environment) })),
    [harnesses, environment, isReadyPair]
  );
  const envItems = useMemo(
    () => environments.map((id) => ({ id, label: id, compatible: isReadyPair(harness, id) })),
    [environments, harness, isReadyPair]
  );
  const renderItem = (item: { label: string; compatible: boolean } | null) => {
    if (!item) return <span />;
    return (
      <span
        className={`compat-item ${item.compatible ? 'is-ok' : 'is-no'}`}
        title={item.compatible ? 'compatible' : 'untested pair'}
      >
        <span className="compat-item-label">{item.label}</span>
        {hasMatrix &&
          (item.compatible ? (
            <span className="compat-badge compat-badge--ok">✓</span>
          ) : (
            <span className="compat-badge compat-badge--no">untested</span>
          ))}
      </span>
    );
  };

  const send = useCallback(async () => {
    if (!prompt.trim() || running || !harness || !environment) return;
    const turnId = `${Date.now()}`;
    const assistantId = `assistant-${turnId}`;
    const userMsg: ChatMessage = { id: `user-${turnId}`, role: 'user', text: prompt, events: [] };
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', text: '', events: [] };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    const promptSnapshot = prompt;
    setPrompt('');
    setRunning(true);
    setPreviewUrl(null);
    // Start a fresh live-event timeline + header for this run.
    setLiveRecords([]);
    seqRef.current = 0;
    runStartRef.current = Date.now();
    setLiveHeader({
      runId: null,
      harnessRef: harness,
      envRef: environment,
      model: null,
      prompt: promptSnapshot,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      durationMs: null,
      terminalCause: null,
      sandboxId: null,
      previewUrl: null,
    });

    const applyEvent = (ev: EngineEvent) => {
      setMessages((m) => {
        const targetIndex = m.findIndex((msg) => msg.id === assistantId);
        if (targetIndex < 0) return m;
        const next = [...m];
        const target = next[targetIndex];
        const updated: ChatMessage = { ...target, events: [...target.events, ev.type] };
        if (ev.type === 'stream_chunk') updated.text += ev.text;
        else if (ev.type === 'final_text' && !updated.text) updated.text = ev.text;
        else if (ev.type === 'tool_call')
          updated.text += `\n[tool: ${ev.name}]`;
        next[targetIndex] = updated;
        return next;
      });
    };

    // Record EVERY EngineEvent into the live timeline + fold metadata into the
    // header (running usage tally, preview, terminal cause).
    const recordEvent = (ev: EngineEvent) => {
      setLiveRecords((rs) => [...rs, { ev, at: Date.now(), seq: seqRef.current++ }]);
      setLiveHeader((h) => {
        if (!h) return h;
        if (ev.type === 'usage_delta') {
          return { ...h, inputTokens: h.inputTokens + ev.inputTokens, outputTokens: h.outputTokens + ev.outputTokens };
        }
        if (ev.type === 'preview_ready') return { ...h, previewUrl: ev.url };
        if (ev.type === 'terminal') {
          return { ...h, terminalCause: ev.cause, durationMs: Date.now() - runStartRef.current };
        }
        return h;
      });
    };

    try {
      await streamRun(
        {
          harness,
          environment,
          prompt: promptSnapshot,
          sessionId: sessionRef.current,
          projectId: projectId ?? undefined,
          topology: topology ?? undefined,
        },
        {
          onEvent: (name, data) => {
            // Meta frames: run_started carries the runId; settled carries the
            // final billing summary — fold both into the live header.
            if (name === 'run_started') {
              const meta = data as { runId?: string };
              if (meta.runId) setLiveHeader((h) => (h ? { ...h, runId: meta.runId! } : h));
              return;
            }
            if (name === 'settled') {
              const r = data as { cost?: number; durationMs?: number };
              setLiveHeader((h) =>
                h ? { ...h, cost: r.cost ?? h.cost, durationMs: Date.now() - runStartRef.current } : h
              );
              return;
            }
            const ev = data as EngineEvent;
            if (ev.type === 'preview_ready') setPreviewUrl(ev.url);
            recordEvent(ev);
            // `log` events are diagnostics only — they never flow into chat.
            if (ev.type === 'log') return;
            applyEvent(ev);
          },
        }
      );
    } catch (err) {
      const ev: EngineEvent = {
        type: 'terminal',
        cause: 'error',
        error: { code: 'client', message: String(err) },
      };
      recordEvent(ev);
      applyEvent(ev);
    } finally {
      setRunning(false);
    }
  }, [prompt, running, harness, environment, topology, projectId]);

  const displayRunFromActivity = useCallback((records: EventRecord[], header: RunHeader | null) => {
    setPreviewUrl(previewUrlFromRecords(records));
    setMessages([assistantMessageFromRecords(records, `replay-${header?.runId ?? Date.now()}`)]);
  }, []);

  const resetSession = () => {
    sessionRef.current = `${SESSION_PREFIX}${Date.now()}`;
    setMessages([]);
    setPreviewUrl(null);
    setLiveRecords([]);
    setLiveHeader(null);
  };

  return (
    <Theme theme="white">
      <div className="app-shell">
        <Header aria-label="Modular Runner Studio">
          <HeaderName href="#" prefix="Modular">
            Runner Studio
          </HeaderName>
          <nav className="studio-tabs" aria-label="Studio views">
            <Button
              kind={view === 'runner' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('runner')}
            >
              Runner
            </Button>
            <Button
              kind={view === 'architecture' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('architecture')}
            >
              Architecture
            </Button>
          </nav>
          <HeaderGlobalBar>
            {/* Fixed test-account identity. Drives the RLS-scoped project + history views. */}
            {currentUser ? (
              <div className="auth-bar">
                <Tag type="blue" size="sm">{currentUser.email}</Tag>
              </div>
            ) : (
              <div className="auth-bar">
                {authError ? (
                  <Tag type="red" size="sm">{authError}</Tag>
                ) : (
                  <InlineLoading description="Test account…" />
                )}
              </div>
            )}
            <HeaderGlobalAction aria-label="New session" onClick={resetSession}>
              <Renew size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>
        </Header>

        {view === 'runner' ? (
          <>
            <div className="workspace">
              {/* LEFT: chat + the two-seam swap controls */}
              <section className="chat-pane">
                <div className="chat-config">
                  <div className="config-field">
                    <Dropdown
                      id="harness-select"
                      titleText="Harness"
                      label="Select harness"
                      items={harnessItems}
                      selectedItem={harnessItems.find((i) => i.id === harness) ?? null}
                      itemToString={(i) => i?.label ?? ''}
                      itemToElement={renderItem}
                      onChange={({ selectedItem }) =>
                        selectedItem && setHarness(selectedItem.id)
                      }
                    />
                    {hasMatrix && (
                      <div className="compat-hint">
                        Compatible with <b>{environment}</b>:{' '}
                        {harnessesForEnv.length ? harnessesForEnv.join(', ') : '— none'}
                      </div>
                    )}
                  </div>
                  <div className="config-field">
                    <Dropdown
                      id="env-select"
                      titleText="Environment"
                      label="Select environment"
                      items={envItems}
                      selectedItem={envItems.find((i) => i.id === environment) ?? null}
                      itemToString={(i) => i?.label ?? ''}
                      itemToElement={renderItem}
                      onChange={({ selectedItem }) =>
                        selectedItem && setEnvironment(selectedItem.id)
                      }
                    />
                    {hasMatrix && (
                      <div className="compat-hint">
                        Compatible with <b>{harness}</b>:{' '}
                        {envsForHarness.length ? envsForHarness.join(', ') : '— none'}
                      </div>
                    )}
                  </div>
                  {/* The execution-topology toggle: agent × sandbox-as-tool vs
                      agent-in-sandbox. Spans the full row (its own line under
                      Harness/Environment) so the longer labels stay readable.
                      Only the topologies the current (harness, env) pair can
                      actually run are offered. */}
                  <div className="config-field config-field--full">
                    <Dropdown
                      id="topology-select"
                      titleText="Topology"
                      label="Select topology"
                      items={topologyItems}
                      selectedItem={topologyItems.find((i) => i.id === topology) ?? null}
                      itemToString={(i) => i?.label ?? ''}
                      disabled={topologyItems.length <= 1}
                      onChange={({ selectedItem }) =>
                        selectedItem && setTopology(selectedItem.id)
                      }
                    />
                    {hasTopologyMatrix && (
                      <div className="compat-hint">
                        {topology
                          ? TOPOLOGY_BLURB[topology]
                          : '— no topology available for this pair'}
                      </div>
                    )}
                  </div>
                </div>
                {hasMatrix && (
                  <div className="compat-status">
                    <Tag type={currentPairReady ? 'green' : 'magenta'} size="sm">
                      {currentPairReady
                        ? `${harness} × ${environment} — verified pair`
                        : `${harness} × ${environment} — untested pair`}
                    </Tag>
                    {topology && (
                      <Tag type="cyan" size="sm" title={TOPOLOGY_BLURB[topology]}>
                        {TOPOLOGY_LABEL[topology]}
                      </Tag>
                    )}
                  </div>
                )}
                {defaultHint && (
                  <div className="default-hint" title={defaultHint}>
                    {defaultHint}
                  </div>
                )}

                {/* Project scope: runs are attributed to this project and become
                    visible only to its members (RLS). Logged-out / no-project
                    states are surfaced so the empty history is never a mystery. */}
                <div className="scope-bar">
                  {!currentUser ? (
                    <Tag type={authError ? 'red' : 'gray'} size="sm">
                      {authError ?? 'Preparing test account'}
                    </Tag>
                  ) : projects.length === 0 ? (
                    <Tag type="magenta" size="sm">No projects for {currentUser.email} — isolated, nothing to run</Tag>
                  ) : (
                    <label className="scope-pick">
                      <span>Project</span>
                      <select
                        value={projectId ?? ''}
                        onChange={(e) => setProjectId(e.target.value || null)}
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="chat-log" ref={logRef}>
                  {messages.length === 0 && (
                    <div className="preview-empty" style={{ minHeight: 120 }}>
                      Pick a harness × environment, type a prompt, and send.
                    </div>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`msg msg-${m.role}`}>
                      {m.text || (m.role === 'assistant' && running ? '…' : '')}
                      {m.role === 'assistant' && m.events.length > 0 && (
                        <div className="event-trace">
                          {m.events.map((e, j) => (
                            <span className="ev" key={j}>
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="chat-input">
                  <TextArea
                    id="prompt"
                    labelText=""
                    placeholder="Describe what to build…"
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
                    }}
                  />
                  {running ? (
                    <InlineLoading description="Running…" />
                  ) : (
                    <Button
                      renderIcon={Send}
                      onClick={send}
                      disabled={!prompt.trim() || !currentUser || !projectId || !harness || !environment}
                    >
                      Send
                    </Button>
                  )}
                </div>
              </section>

              {/* RIGHT: preview pane bound to env.exposePort() URL */}
              <section className="preview-pane">
                <div className="preview-bar">
                  <Application size={16} />
                  <span>Preview</span>
                  {previewUrl ? (
                    <Tag type="green" size="sm">
                      {previewUrl}
                    </Tag>
                  ) : (
                    <Tag type="gray" size="sm">
                      no preview yet
                    </Tag>
                  )}
                </div>
                {previewUrl ? (
                  <iframe className="preview-frame" src={previewUrl} title="preview" />
                ) : (
                  <div className="preview-empty">
                    The preview iframe binds to the environment&rsquo;s exposePort() URL.
                  </div>
                )}
              </section>
            </div>

            {/* BOTTOM: Activity Log — full EngineEvent stream for the live run, plus
                cross-run history browse/replay and debug tooling (filters, search,
                timestamps, raw JSON, copy/export). See studio/src/ActivityLog.tsx. */}
            <ActivityLog
              liveRecords={liveRecords}
              liveHeader={liveHeader}
              running={running}
              authVersion={authVersion}
              onReplaySelected={displayRunFromActivity}
            />
          </>
        ) : (
          <ArchitectureFlow />
        )}
      </div>
    </Theme>
  );
}
