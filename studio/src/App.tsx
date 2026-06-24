import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Theme,
  Select,
  SelectItem,
  TextArea,
  Button,
  Tag,
  InlineLoading,
} from '@carbon/react';
import { Send, Renew, Application } from '@carbon/icons-react';
import { streamRun, warmSession, fetchRegistry, type EngineEvent } from './sse';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  events: string[]; // event-type trace for this turn
}

interface LogLine {
  category: 'kernel' | 'env' | 'harness';
  level: 'info' | 'warn' | 'error';
  message: string;
  at: number;
}

const SESSION_PREFIX = 'studio-';

export default function App() {
  const [harnesses, setHarnesses] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [harness, setHarness] = useState('dummy');
  const [environment, setEnvironment] = useState('dummy');
  const [prompt, setPrompt] = useState('Build a hello-world dev server');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activityLog, setActivityLog] = useState<LogLine[]>([]);
  const [defaultHint, setDefaultHint] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
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
        const d = r.defaults;
        // Canonical Studio default = pi + e2b (main agent on an isolated sandbox).
        // Fall back to the backend recommendation / first listed only if either is
        // not registered.
        const pickH = r.harnesses.includes('pi')
          ? 'pi'
          : d && r.harnesses.includes(d.harness)
            ? d.harness
            : r.harnesses[0];
        const pickE = r.environments.includes('e2b')
          ? 'e2b'
          : d && r.environments.includes(d.environment)
            ? d.environment
            : r.environments[0];
        if (pickH) setHarness(pickH);
        if (pickE) setEnvironment(pickE);
        if (d) setDefaultHint(d.reason);
        // Warm the sandbox ONCE on page load for the DEFAULT harness×env, so the
        // cold start is paid while the user reads/types — not on send. We use the
        // resolved picks directly (state isn't applied yet here). Deliberately NOT
        // re-warmed on selector change: switching env should not spin up sandboxes.
        if (pickH && pickE && pickH !== 'dummy' && pickE !== 'dummy') {
          void warmSession({ sessionId: sessionRef.current, harness: pickH, environment: pickE });
        }
      })
      .catch(() => {
        // Backend not up yet — keep the dummy defaults.
        setHarnesses(['dummy', 'dummy-echo']);
        setEnvironments(['dummy']);
      });
  }, []);

  useEffect(() => {
    activityRef.current?.scrollTo({ top: activityRef.current.scrollHeight });
  }, [activityLog]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    if (!prompt.trim() || running) return;
    const userMsg: ChatMessage = { role: 'user', text: prompt, events: [] };
    const assistantMsg: ChatMessage = { role: 'assistant', text: '', events: [] };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    const promptSnapshot = prompt;
    setPrompt('');
    setRunning(true);
    setPreviewUrl(null);
    setActivityLog([]);

    const idx = messages.length + 1; // index of the assistant message just pushed

    const applyEvent = (ev: EngineEvent) => {
      setMessages((m) => {
        const next = [...m];
        const target = next[idx];
        if (!target) return m;
        const updated: ChatMessage = { ...target, events: [...target.events, ev.type] };
        if (ev.type === 'stream_chunk') updated.text += ev.text;
        else if (ev.type === 'final_text' && !updated.text) updated.text = ev.text;
        else if (ev.type === 'tool_call')
          updated.text += `\n[tool: ${ev.name}]`;
        next[idx] = updated;
        return next;
      });
    };

    try {
      await streamRun(
        { harness, environment, prompt: promptSnapshot, sessionId: sessionRef.current },
        {
          onEvent: (name, data) => {
            if (name === 'run_started' || name === 'settled') return;
            const ev = data as EngineEvent;
            if (ev.type === 'preview_ready') setPreviewUrl(ev.url);
            // The diagnostic side-channel feeds the bottom Activity Log, not chat.
            if (ev.type === 'log') {
              setActivityLog((l) => [
                ...l,
                { category: ev.category, level: ev.level, message: ev.message, at: ev.at },
              ]);
              return;
            }
            applyEvent(ev);
          },
        }
      );
    } catch (err) {
      applyEvent({
        type: 'terminal',
        cause: 'error',
        error: { code: 'client', message: String(err) },
      });
    } finally {
      setRunning(false);
    }
  }, [prompt, running, harness, environment, messages.length]);

  const resetSession = () => {
    sessionRef.current = `${SESSION_PREFIX}${Date.now()}`;
    setMessages([]);
    setPreviewUrl(null);
    setActivityLog([]);
  };

  return (
    <Theme theme="white">
      <div className="app-shell">
        <Header aria-label="Modular Runner Studio">
          <HeaderName href="#" prefix="Modular">
            Runner Studio
          </HeaderName>
          <HeaderGlobalBar>
            <HeaderGlobalAction aria-label="New session" onClick={resetSession}>
              <Renew size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>
        </Header>

        <div className="workspace">
          {/* LEFT: chat + the two-seam swap controls */}
          <section className="chat-pane">
            <div className="chat-config">
              <Select
                id="harness-select"
                labelText="Harness"
                value={harness}
                onChange={(e) => setHarness(e.target.value)}
              >
                {harnesses.map((h) => (
                  <SelectItem key={h} value={h} text={h} />
                ))}
              </Select>
              <Select
                id="env-select"
                labelText="Environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                {environments.map((env) => (
                  <SelectItem key={env} value={env} text={env} />
                ))}
              </Select>
            </div>
            {defaultHint && (
              <div className="default-hint" title={defaultHint}>
                {defaultHint}
              </div>
            )}

            <div className="chat-log" ref={logRef}>
              {messages.length === 0 && (
                <div className="preview-empty" style={{ minHeight: 120 }}>
                  Pick a harness × environment, type a prompt, and send.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`msg msg-${m.role}`}>
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
                <Button renderIcon={Send} onClick={send} disabled={!prompt.trim()}>
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

        {/* BOTTOM: Activity Log — the `log` EngineEvent side-channel. Narrates the
            kernel run + env substrate + harness (CLI) lifecycle; chat/billing
            ignore these events, only this panel renders them. */}
        <section className="activity-log">
          <div className="activity-bar">
            <span>Activity Log</span>
            <Tag type="gray" size="sm">
              {activityLog.length} events
            </Tag>
          </div>
          <div className="activity-lines" ref={activityRef}>
            {activityLog.length === 0 ? (
              <div className="activity-empty">
                Kernel, environment, and harness lifecycle will stream here.
              </div>
            ) : (
              activityLog.map((l, i) => (
                <div key={i} className={`activity-line lvl-${l.level}`}>
                  <span className={`cat cat-${l.category}`}>{l.category}</span>
                  <span className="activity-msg">{l.message}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Theme>
  );
}
