import type { CodeViewProps } from '../../types/file-reader'

// Read-only code view (v1). Renders the file as a plain monospace `<pre>` with line numbers using
// HeroUI semantic tokens + structural layout only (NO custom CSS).
//
// SYNTAX-HIGHLIGHT DEP FLAG: full token-colour highlighting (legacy used `react-syntax-highlighter`
// Prism) is intentionally NOT done here — neither Prism nor a Shiki HTML renderer is wired in this
// island. `@streamdown/code` exposes a Shiki *tokenizer* (returns `TokensResult`, not ready HTML),
// so wiring real highlighting means either rendering those tokens to themed spans or adding a
// highlighter dep. v1 ships an honest, readable, unstyled-but-legible code view; `language` is
// threaded through so the highlighter can be dropped in without an API change. See file-reader.md §3
// (CodeView row, "3rd-party").

export function CodeView({ content }: CodeViewProps) {
  const lines = content.split('\n')
  return (
    <div className="min-w-max font-mono text-xs leading-relaxed">
      <table className="border-separate border-spacing-0">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td className="select-none pr-3 pl-3 text-right align-top text-muted">{i + 1}</td>
              <td className="whitespace-pre pr-3 align-top text-foreground">{line || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
