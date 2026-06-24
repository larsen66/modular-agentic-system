// Agent Stream DevTools panel.
// Polls the inspected page's window.__AGENT_INSPECTOR__ bridge (installed by src/core/inspector.ts)
// for new records by seq cursor and renders one end-to-end run timeline: user request → run
// lifecycle (phases, frames, final_result) → kernel EngineEvents → net. No content script needed —
// the bridge is a plain serializable global, read via chrome.devtools.inspectedWindow.eval.

// Per-EngineEvent accent (kernel layer) so tool calls vs text vs lifecycle are scannable.
const EVENT_COLOR = {
  run_started: '#34d399',
  stream_chunk: '#cbd5e1',
  final_text: '#facc15',
  tool_call: '#f472b6',
  tool_result: '#22d3ee',
  preview_ready: '#fb923c',
  terminal: '#34d399',
  settled: '#34d399',
  final_result: '#facc15',
  request: '#38bdf8',
}

const ALL_SOURCES = ['user', 'run', 'kernel', 'net']

const state = {
  records: [],
  cursor: 0,
  paused: false,
  autoscroll: true,
  errorsOnly: false,
  filter: '',
  sort: 'seq-asc',
  sources: new Set(ALL_SOURCES),
  connected: false,
  expanded: new Set(),
}

const els = {
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  filter: document.getElementById('filter'),
  pause: document.getElementById('pause'),
  autoscroll: document.getElementById('autoscroll'),
  errors: document.getElementById('errors'),
  sort: document.getElementById('sort'),
  exportBtn: document.getElementById('export'),
  clear: document.getElementById('clear'),
  chips: Array.from(document.querySelectorAll('.chip')),
}

function eventColor(r) {
  if (EVENT_COLOR[r.event]) return EVENT_COLOR[r.event]
  return ''
}
function fmtTime(ts) {
  const d = new Date(ts)
  const p = (n, l = 2) => String(n).padStart(l, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}
function shortRun(id) {
  return id ? `#${String(id).slice(0, 8)}` : ''
}
function summarize(r) {
  const d = r.data
  if (d == null) return ''
  if (typeof d === 'string') return d.slice(0, 200)
  if (r.event === 'request') return String(d.text || '').slice(0, 200)
  if (r.event === 'final_result') return String(d.text || '').slice(0, 200)
  if (r.event === 'notice') return String(d.text || '').slice(0, 200)
  if (r.event === 'stream_chunk') return String(d.text || '').slice(0, 200)
  if (r.event === 'final_text') return `${String(d.text || '').length} chars`
  if (r.event === 'tool_call') return `${d.name || ''}${d.callId ? ` #${String(d.callId).slice(0, 8)}` : ''}`
  if (r.event === 'tool_result') return `${d.ok === false ? 'error' : 'ok'}${d.callId ? ` #${String(d.callId).slice(0, 8)}` : ''}`
  if (r.event === 'terminal') return String(d.cause || '')
  if (r.event === 'stream_end') return d.aborted ? 'aborted' : 'done'
  if (r.event && r.event.startsWith('phase:')) return JSON.stringify(d)
  if (r.event && r.event.startsWith('progress:')) {
    const payload = d.payload || {}
    return String(payload.content || payload.tool || payload.message?.content || '').slice(0, 200)
  }
  if (r.level === 'error') return String(d.message || d.status || d.error || '').slice(0, 200)
  try {
    return JSON.stringify(d).slice(0, 200)
  } catch {
    return ''
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function visible() {
  const q = state.filter.trim().toLowerCase()
  let rows = state.records.filter((r) => state.sources.has(r.source))
  if (state.errorsOnly) rows = rows.filter((r) => r.level === 'error')
  if (q) {
    rows = rows.filter((r) => {
      if (r.event.toLowerCase().includes(q)) return true
      if (r.source.includes(q)) return true
      if (r.runId && String(r.runId).toLowerCase().includes(q)) return true
      try {
        return JSON.stringify(r.data).toLowerCase().includes(q)
      } catch {
        return false
      }
    })
  }
  const s = state.sort
  if (s === 'seq-desc') rows = rows.slice().sort((a, b) => b.seq - a.seq)
  else if (s === 'source') rows = rows.slice().sort((a, b) => a.source.localeCompare(b.source) || a.seq - b.seq)
  else if (s === 'event') rows = rows.slice().sort((a, b) => a.event.localeCompare(b.event) || a.seq - b.seq)
  // seq-asc is the natural buffer order — no sort needed.
  return rows
}

function render() {
  const rows = visible()
  els.count.textContent = `(${rows.length})`

  if (!state.connected) {
    els.list.innerHTML =
      '<div class="disconnected">Agent inspector bridge not found on this page.<br/>Open the app (apps/next) and reload — window.__AGENT_INSPECTOR__ is installed by core/inspector.ts.</div>'
    return
  }
  if (rows.length === 0) {
    els.list.innerHTML =
      '<div class="empty">No matching events. Send a message — user request, run lifecycle, kernel frames and the final result stream here.</div>'
    return
  }

  const atBottom = els.list.scrollHeight - els.list.scrollTop - els.list.clientHeight < 40

  els.list.innerHTML = rows
    .map((r) => {
      const open = state.expanded.has(r.seq)
      const json = (() => {
        try {
          return JSON.stringify(r.data, null, 2)
        } catch {
          return String(r.data)
        }
      })()
      const evColor = eventColor(r)
      const evStyle = r.level === 'error' ? '' : evColor ? ` style="color:${evColor}"` : ''
      const rid = r.runId
        ? ` <span class="rid" data-rid="${escapeHtml(r.runId)}" title="filter this run">${escapeHtml(shortRun(r.runId))}</span>`
        : ''
      return (
        `<div class="row${r.level === 'error' ? ' err' : ''}">` +
        `<div class="head" data-seq="${r.seq}">` +
        `<span class="seq">${r.seq}</span>` +
        `<span class="time">${fmtTime(r.ts)}</span>` +
        `<span class="src ${r.source}">${r.source}</span>` +
        `<span class="event${r.level === 'error' ? ' err' : ''}"${evStyle}>${escapeHtml(r.event)}</span>` +
        `<span class="summary">${escapeHtml(summarize(r))}${rid}</span>` +
        `</div>` +
        (open ? `<pre>${escapeHtml(json)}</pre>` : '') +
        `</div>`
      )
    })
    .join('')

  if (state.autoscroll && state.sort === 'seq-asc' && atBottom) {
    els.list.scrollTop = els.list.scrollHeight
  }
}

// Delegated clicks: runId chip → filter that run; row head → expand.
els.list.addEventListener('click', (e) => {
  const rid = e.target.closest('.rid')
  if (rid) {
    e.stopPropagation()
    state.filter = rid.dataset.rid
    els.filter.value = state.filter
    render()
    return
  }
  const head = e.target.closest('.head')
  if (!head) return
  const seq = Number(head.dataset.seq)
  if (state.expanded.has(seq)) state.expanded.delete(seq)
  else state.expanded.add(seq)
  render()
})

function evalInPage(expr) {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(expr, (result, exc) => {
      resolve(exc ? null : result)
    })
  })
}

async function poll() {
  if (state.paused) return
  const head = await evalInPage('window.__AGENT_INSPECTOR__ ? window.__AGENT_INSPECTOR__.head() : -1')
  if (head === null || head === -1) {
    if (state.connected) {
      state.connected = false
      render()
    }
    return
  }
  if (!state.connected) {
    state.connected = true
    state.cursor = 0
    state.records = []
  }
  if (head < state.cursor) {
    // Page reloaded — the ring restarted. Resync from scratch.
    state.cursor = 0
    state.records = []
    state.expanded.clear()
  }
  if (head <= state.cursor) {
    render()
    return
  }
  const fresh = await evalInPage(`JSON.stringify(window.__AGENT_INSPECTOR__.since(${state.cursor}))`)
  if (typeof fresh === 'string') {
    let arr = []
    try {
      arr = JSON.parse(fresh)
    } catch {
      arr = []
    }
    if (arr.length) {
      state.records = state.records.concat(arr)
      if (state.records.length > 4000) state.records = state.records.slice(state.records.length - 4000)
      state.cursor = arr[arr.length - 1].seq
    }
  }
  render()
}

// ── Toolbar wiring ──
els.filter.addEventListener('input', () => {
  state.filter = els.filter.value
  render()
})
els.sort.addEventListener('change', () => {
  state.sort = els.sort.value
  render()
})
els.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const src = chip.dataset.src
    if (state.sources.has(src)) state.sources.delete(src)
    else state.sources.add(src)
    chip.classList.toggle('on', state.sources.has(src))
    render()
  })
})
els.errors.addEventListener('click', () => {
  state.errorsOnly = !state.errorsOnly
  els.errors.classList.toggle('on', state.errorsOnly)
  render()
})
els.pause.addEventListener('click', () => {
  state.paused = !state.paused
  els.pause.textContent = state.paused ? '▶ resume' : '❚❚ pause'
  els.pause.classList.toggle('on', state.paused)
})
els.autoscroll.addEventListener('click', () => {
  state.autoscroll = !state.autoscroll
  els.autoscroll.classList.toggle('on', state.autoscroll)
})
els.clear.addEventListener('click', () => {
  evalInPage('window.__AGENT_INSPECTOR__ && window.__AGENT_INSPECTOR__.clear()')
  state.records = []
  state.expanded.clear()
  render()
})
els.exportBtn.addEventListener('click', () => {
  // Export exactly what's visible (respects source/error/text filters + sort) — handy as an E2E fixture.
  const jsonl = visible().map((r) => JSON.stringify(r)).join('\n')
  const blob = new Blob([jsonl], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agent-stream-${Date.now()}.jsonl`
  a.click()
  URL.revokeObjectURL(url)
})

render()
setInterval(poll, 350)
poll()
