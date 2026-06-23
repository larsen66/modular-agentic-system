// src/harnesses/openai-agents/verify.ts
// Self-contained proof for the `openai-agents` harness.
//
// Drives the real SDK path (Agent + run({stream:true}) + our injectable tools)
// against a local OpenAI Chat Completions mock, wired to a minimal in-memory
// EnvironmentHandle. Everything is real except the model tokens and substrate.
//
// Run: npx tsx src/harnesses/openai-agents/verify.ts
//
// NOTE: this file lives under src/ (compiled by tsconfig). It is a script, not a
// module imported by the kernel — running it has side effects (starts a server,
// drives an in-memory env double) and calls process.exit().

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { EngineEvent, EnvironmentHandle } from '../../types/index.js';

const DEV_PORT = 5173;

// ---------------------------------------------------------------------------
// The local OpenAI Chat-Completions mock. It is NOT an LLM — it runs a
// deterministic tool-loop script that scaffolds a tiny app, "installs", starts a
// dev server, and exposes the port, exactly as a real model would via tool_calls.
// It advances by counting role:"tool" messages echoed back to it.
// ---------------------------------------------------------------------------

type Turn = { text: string; tools: { name: string; input: Record<string, unknown> }[] };

const TURNS: Turn[] = [
  {
    text: 'Scaffolding a minimal app.',
    tools: [{ name: 'write_file', input: { path: 'index.html', content: '<!doctype html><div id="root"></div>' } }],
  },
  {
    text: 'Installing dependencies.',
    tools: [{ name: 'run_command', input: { cmd: 'npm install --no-audit --no-fund', background: false } }],
  },
  {
    text: 'Starting the dev server.',
    tools: [
      {
        name: 'run_command',
        input: { cmd: `npm run dev -- --host 0.0.0.0 --port ${DEV_PORT}`, background: true },
      },
    ],
  },
  {
    text: 'Exposing the dev server port.',
    tools: [{ name: 'expose_port', input: { port: DEV_PORT } }],
  },
  { text: 'Done — a live preview URL is exposed above.', tools: [] },
];

function countToolMessages(messages: unknown[]): number {
  let n = 0;
  for (const m of messages as { role?: string }[]) if (m?.role === 'tool') n++;
  return n;
}

function openAiResponse(idx: number): unknown {
  const turn = TURNS[Math.min(idx, TURNS.length - 1)]!;
  const tool_calls = turn.tools.map((t, i) => ({
    id: `call_${idx}_${i}_${t.name}`,
    type: 'function',
    function: { name: t.name, arguments: JSON.stringify(t.input) },
  }));
  return {
    id: `chatcmpl-mock-${idx}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-openai',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: turn.text || null,
          tool_calls: tool_calls.length ? tool_calls : undefined,
        },
        finish_reason: turn.tools.length ? 'tool_calls' : 'stop',
      },
    ],
    usage: { prompt_tokens: 50 + idx * 10, completion_tokens: 30 + idx * 5, total_tokens: 80 + idx * 15 },
  };
}

// Stream the same scripted turn as SSE chat.completion.chunk events — the shape
// the OpenAI client expects when the request sets `stream:true` (the real SDK
  // path always streams). The non-streaming JSON branch (openAiResponse) is kept
  // as a small compatibility helper for direct mock inspection.
function writeSseTurn(res: http.ServerResponse, idx: number): void {
  const turn = TURNS[Math.min(idx, TURNS.length - 1)]!;
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = (obj: unknown): void => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };
  const base = { id: `chatcmpl-mock-${idx}`, object: 'chat.completion.chunk', model: 'mock-openai' };

  // role + content delta
  send({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: turn.text || '' }, finish_reason: null }] });
  // one tool_call delta per scripted tool (id+name+full arguments in a single delta)
  turn.tools.forEach((t, i) => {
    send({
      ...base,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: i,
                id: `call_${idx}_${i}_${t.name}`,
                type: 'function',
                function: { name: t.name, arguments: JSON.stringify(t.input) },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
  });
  // finish + usage chunk, then [DONE]
  send({
    ...base,
    choices: [{ index: 0, delta: {}, finish_reason: turn.tools.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 50 + idx * 10, completion_tokens: 30 + idx * 5, total_tokens: 80 + idx * 15 },
  });
  res.write('data: [DONE]\n\n');
  res.end();
}

function startMock(): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || !(req.url ?? '').includes('/chat/completions')) {
        res.writeHead(404).end('not found');
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let messages: unknown[] = [];
        let wantsStream = false;
        try {
          const parsed = JSON.parse(body) as { messages?: unknown[]; stream?: boolean };
          messages = parsed.messages ?? [];
          wantsStream = parsed.stream === true;
        } catch {
          /* ignore */
        }
        const idx = countToolMessages(messages);
        if (wantsStream) {
          writeSseTurn(res, idx);
          return;
        }
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(openAiResponse(idx)));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ baseUrl: `http://127.0.0.1:${port}/v1`, close: () => server.close() });
    });
  });
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[verify:openai-agents] driving @openai/agents SDK path');

  // 1) Stand up the mock and point the SDK client at it.
  const mock = await startMock();
  process.env.OPENAI_BASE_URL = mock.baseUrl;
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'sk-verify-mock';
  // eslint-disable-next-line no-console
  console.log(`[verify:openai-agents] driving REAL harness via mock at ${mock.baseUrl}`);

  // 2) Import the harness AFTER env is set. The harness drives a real tool
  //    loop against the opaque EnvironmentHandle contract — so the verify supplies
  //    a minimal in-memory handle (files in a Map, exec→exit 0, exposePort→fake
  //    url). This is a verify-local test double, NOT a registered "provider".
  const harness = (await import('./index.js')).default;

  const files = new Map<string, Buffer>();
  const handle = {
    id: 'verify-oa-env',
    capabilities: {
      publicPorts: false,
      pty: false,
      snapshot: false,
      nativeGit: false,
      fileWatch: false,
      persistentVolume: false,
      hostsAgentRuntime: false,
    },
    async exec() {
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async writeFiles(toWrite: { path: string; content: string | Buffer }[]) {
      for (const f of toWrite) files.set(f.path, Buffer.from(f.content));
    },
    async readFile(path: string) {
      return files.get(path) ?? null;
    },
    async exposePort(port: number) {
      return { url: `http://localhost:${port}/` };
    },
    async destroy() {},
  } as unknown as EnvironmentHandle;

  // 3) Drive the real run loop, collecting EngineEvents.
  const seen: EngineEvent['type'][] = [];
  let toolOk = false;
  let previewUrl: string | null = null;
  let terminalCount = 0;
  let terminalCause: string | null = null;

  const controller = new AbortController();
  await harness.run(
    { runId: 'verify-oa', prompt: 'Build me a todo app', topology: 'agent-as-tool', signal: controller.signal },
    handle,
    {
      emit(ev: EngineEvent) {
        seen.push(ev.type);
        if (ev.type === 'tool_call') console.log(`  → ${ev.name}`);
        if (ev.type === 'tool_result' && ev.ok) toolOk = true;
        if (ev.type === 'preview_ready') {
          previewUrl = ev.url;
          console.log(`  ★ preview_ready: ${ev.url}`);
        }
        if (ev.type === 'terminal') {
          terminalCount++;
          terminalCause = ev.cause;
          console.log(`  ■ terminal: ${ev.cause}${ev.error ? ' ' + JSON.stringify(ev.error) : ''}`);
        }
      },
    }
  );

  await handle.destroy();
  mock.close();

  const onceSettled = terminalCount === 1;
  const pass = toolOk && !!previewUrl && terminalCause === 'done' && onceSettled;

  // eslint-disable-next-line no-console
  console.log('\n================== verify:openai-agents ==================');
  console.log(`real harness ran a tool against env:  ${toolOk ? 'YES ✓' : 'NO ✗'}`);
  console.log(`preview_ready emitted:                ${previewUrl ? 'YES ✓ ' + previewUrl : 'NO ✗'}`);
  console.log(`settled exactly once (count=${terminalCount}):       ${onceSettled ? 'YES ✓' : 'NO ✗'}`);
  console.log(`terminal cause=done:                  ${terminalCause === 'done' ? 'YES ✓' : 'NO ✗ (' + terminalCause + ')'}`);
  console.log(`event order: [${seen.join(', ')}]`);
  console.log('=========================================================');
  console.log(pass ? '\n[verify:openai-agents] PASS ✅' : '\n[verify:openai-agents] FAIL ❌');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[verify:openai-agents] FAIL:', e);
  process.exit(1);
});
