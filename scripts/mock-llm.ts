// scripts/mock-llm.ts
// A local server that speaks the ANTHROPIC MESSAGES API wire format, so the real
// SDK harness talks to it over real HTTP with zero code changes — point
// ANTHROPIC_BASE_URL at it and the harness believes it's Claude. It is NOT an
// LLM: it runs a deterministic, realistic tool-loop script that builds a real
// Vite + React app, installs deps, starts the dev server, and exposes the port.
//
// PURPOSE: prove the ENTIRE real path (harness HTTP + tool-loop + real Docker
// exec/writeFiles + real npm install + real Vite dev server + real proxied
// preview) without needing a paid API key. Swapping ANTHROPIC_BASE_URL back to
// the real endpoint (and setting ANTHROPIC_API_KEY) gives a real LLM, same code.
//
// It inspects the incoming `messages` to decide its next turn (how many
// tool_result blocks it has already received), exactly as a stateful model would.

import http from 'node:http';

const PORT = Number(process.env.MOCK_LLM_PORT ?? 8787);
const DEV_PORT = 5173;

// ---- The real Vite + React app the "model" will scaffold ----------------------
const FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'generated-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
      devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.6' },
    },
    null,
    2
  ),
  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: ${DEV_PORT}, strictPort: true },
});
`,
  'index.html': `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Generated Todo App</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  'src/main.jsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<App />);
`,
  'src/App.jsx': `import React, { useState } from 'react';
export default function App() {
  const [items, setItems] = useState(['Try the live preview', 'Add a todo']);
  const [text, setText] = useState('');
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 480, margin: '40px auto', padding: 16 }}>
      <h1 data-testid="title">Generated Todo App</h1>
      <p>Built by a real agent loop in a real container.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { setItems([...items, text]); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}
`,
};

// ---- The scripted turns (one per assistant step) ------------------------------
// Each turn returns text + the tool_use blocks the "model" wants run next. The
// harness runs them and sends back tool_result blocks; we count those to advance.
type Turn = { text: string; tools: { name: string; input: Record<string, unknown> }[] };

function buildTurns(): Turn[] {
  const writeTurns: Turn[] = Object.entries(FILES).map(([path, content], i) => ({
    text: i === 0 ? 'Scaffolding a real Vite + React todo app.' : '',
    tools: [{ name: 'write_file', input: { path, content } }],
  }));

  return [
    ...writeTurns,
    { text: 'Installing dependencies.', tools: [{ name: 'run_command', input: { cmd: 'npm install --no-audit --no-fund' } }] },
    {
      text: 'Starting the Vite dev server.',
      tools: [
        {
          name: 'run_command',
          input: { cmd: `npm run dev -- --host 0.0.0.0 --port ${DEV_PORT}`, background: true },
        },
      ],
    },
    { text: 'Exposing the dev server port for a live preview.', tools: [{ name: 'expose_port', input: { port: DEV_PORT } }] },
    {
      text: 'Done — a real Vite + React todo app is running in the sandbox and the live preview URL is exposed above. Add a todo to see it work.',
      tools: [],
    },
  ];
}

const TURNS = buildTurns();

// Turn counter for the ANTHROPIC wire: count tool_result blocks in user turns.
function countAnthropicToolResults(messages: unknown[]): number {
  let n = 0;
  for (const m of messages as { role: string; content: unknown }[]) {
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const block of m.content as { type?: string }[]) {
      if (block.type === 'tool_result') n++;
    }
  }
  return n;
}

// Turn counter for the OPENAI wire: count role:"tool" messages sent back.
function countOpenAiToolResults(messages: unknown[]): number {
  let n = 0;
  for (const m of messages as { role: string }[]) {
    if (m.role === 'tool') n++;
  }
  return n;
}

function anthropicResponse(idx: number): unknown {
  const turn = TURNS[idx]!;
  const content: unknown[] = [];
  if (turn.text) content.push({ type: 'text', text: turn.text });
  for (const t of turn.tools)
    content.push({ type: 'tool_use', id: `mock_${idx}_${t.name}`, name: t.name, input: t.input });
  return {
    id: `msg_mock_${idx}`,
    type: 'message',
    role: 'assistant',
    model: 'mock-anthropic',
    content,
    stop_reason: turn.tools.length ? 'tool_use' : 'end_turn',
    usage: { input_tokens: 50 + idx * 10, output_tokens: 30 + idx * 5 },
  };
}

function openAiResponse(idx: number): unknown {
  const turn = TURNS[idx]!;
  const tool_calls = turn.tools.map((t) => ({
    id: `mock_${idx}_${t.name}`,
    type: 'function',
    function: { name: t.name, arguments: JSON.stringify(t.input) },
  }));
  return {
    id: `chatcmpl-mock-${idx}`,
    object: 'chat.completion',
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
    usage: { prompt_tokens: 50 + idx * 10, completion_tokens: 30 + idx * 5 },
  };
}

// One mock, BOTH wire formats — so the real SDK harness can be driven via either
// ANTHROPIC_BASE_URL (/v1/messages) or OPENAI_BASE_URL (/chat/completions),
// proving both provider code paths without a real key.
const server = http.createServer((req, res) => {
  const url = req.url ?? '';
  if (req.method !== 'POST') {
    res.writeHead(404).end('not found');
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let messages: unknown[] = [];
    try {
      messages = (JSON.parse(body) as { messages?: unknown[] }).messages ?? [];
    } catch {
      /* ignore */
    }

    if (url.endsWith('/v1/messages')) {
      const idx = Math.min(countAnthropicToolResults(messages), TURNS.length - 1);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(anthropicResponse(idx)));
      return;
    }
    if (url.endsWith('/chat/completions')) {
      const idx = Math.min(countOpenAiToolResults(messages), TURNS.length - 1);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(openAiResponse(idx)));
      return;
    }
    res.writeHead(404).end('not found');
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mock-llm] dual-wire mock on http://localhost:${PORT}\n` +
      `  Anthropic: set ANTHROPIC_BASE_URL=http://localhost:${PORT}  (POST /v1/messages)\n` +
      `  OpenAI:    set OPENAI_BASE_URL=http://localhost:${PORT}/v1   (POST /chat/completions)`
  );
});
