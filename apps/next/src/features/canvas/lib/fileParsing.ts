import type { ParsedTable } from '../types/file-reader'

// Pure file-parsing helpers for the `file-reader` screen — CSV/TSV detection + RFC4180-ish parsing
// and the extension→highlighter-language map. Recreated from legacy `FileContentView.tsx`
// (:15-108) with the same behaviour; no UI cost when the file is not tabular (parse runs only when
// the table view is actually rendered — see `useFileContent`).

/** Hard cap on rendered table rows (full file still parsed; UI shows first N + a notice). */
export const MAX_TABLE_ROWS = 500

const TABULAR_EXT_RE = /\.(csv|tsv)$/i

/** True for a CSV/TSV path (drives the default Table view + toggle). */
export function isTabularPath(path: string): boolean {
  return TABULAR_EXT_RE.test(path)
}

/**
 * Sniff the delimiter: `.tsv` → tab; otherwise count `,`/`;`/`\t` on the first line outside quotes
 * (BOM stripped so it doesn't bias the count). Defaults to `,` when nothing is found.
 */
export function detectDelimiter(text: string, path: string): string {
  if (/\.tsv$/i.test(path)) return '\t'
  const sample = text.replace(/^\uFEFF/, '').slice(0, 4000)
  let inQuotes = false
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  for (let i = 0; i < sample.length; i++) {
    const ch = sample[i]
    if (ch === '"') {
      if (inQuotes && sample[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (inQuotes) continue
    if (ch === '\n') break
    if (ch === ',' || ch === ';' || ch === '\t') counts[ch]++
  }
  const ranked = (Object.entries(counts) as [string, number][]).sort(([, a], [, b]) => b - a)
  return ranked[0][1] > 0 ? ranked[0][0] : ','
}

/**
 * RFC4180-ish parser: quoted fields, doubled-quote escape, embedded delimiters/newlines inside
 * quotes, BOM strip, tolerates a missing trailing newline and stray `\r`. Caps at `maxRows` data
 * rows + the header; `truncated` flags when the file had more.
 */
export function parseDelimited(
  text: string,
  delimiter: string,
  maxRows: number,
): { rows: string[][]; truncated: boolean; totalRows: number } {
  const stripped = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let totalRows = 0
  const pushRow = () => {
    row.push(field)
    field = ''
    if (row.length > 1 || row[0] !== '') {
      totalRows++
      if (rows.length <= maxRows) rows.push(row)
    }
    row = []
  }
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"'
          i++
          continue
        }
        inQuotes = false
        continue
      }
      field += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      pushRow()
      if (ch === '\r' && stripped[i + 1] === '\n') i++
      continue
    }
    field += ch
  }
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }
  return { rows, truncated: totalRows > rows.length, totalRows }
}

/** Parse a tabular file into a `ParsedTable` (delimiter sniff + capped parse). */
export function parseTable(content: string, path: string): ParsedTable {
  const delimiter = detectDelimiter(content, path)
  const { rows, truncated, totalRows } = parseDelimited(content, delimiter, MAX_TABLE_ROWS)
  return { delimiter, rows, truncated, totalRows }
}

const LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  json: 'json', css: 'css', scss: 'scss', less: 'less', html: 'html', xml: 'xml', svg: 'xml',
  md: 'markdown', mdx: 'markdown', py: 'python', sh: 'bash', bash: 'bash', zsh: 'bash',
  yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini',
  go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cs: 'csharp',
  rb: 'ruby', php: 'php', sql: 'sql', graphql: 'graphql', gql: 'graphql',
  dockerfile: 'docker', env: 'bash',
}

/** Map a path to a highlighter language id (`text` when unknown). */
export function languageForPath(path: string): string {
  const base = path.split('/').pop() || path
  if (base.toLowerCase() === 'dockerfile') return 'docker'
  const dotIdx = base.lastIndexOf('.')
  if (dotIdx <= 0) return 'text'
  const ext = base.slice(dotIdx + 1).toLowerCase()
  return LANG_BY_EXT[ext] || 'text'
}
