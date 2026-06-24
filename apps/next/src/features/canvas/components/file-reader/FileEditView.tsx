import { Alert } from '@heroui/react'
import { Info } from 'lucide-react'
import type { FileEditViewProps } from '../../types/file-reader'

// Edit view. v1 is a native <textarea> (no new dep) so the Save path is genuinely exercisable when
// the principal has edit authority — HeroUI chrome (toolbar/Save/Cancel) lives in the screen.
//
// MONACO DEP FLAG: the legacy edit experience was Monaco (`@monaco-editor/react`, vs-dark, line
// numbers, no minimap). Monaco is NOT installed in this island (see package.json) — adding it is a
// dependency decision. When `readOnly` is true (no editable surface available) this renders a
// read-only mirror + an honest notice instead of pretending to edit. The editable path uses a plain
// textarea today; swap in Monaco behind this same `FileEditViewProps` contract when the dep lands.

export function FileEditView({ value, onChange, readOnly }: FileEditViewProps) {
  if (readOnly) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="p-3">
          <Alert>
            <Alert.Indicator>
              <Info className="size-4" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Description>
                Editing is read-only in this build — an in-browser editor is not yet available here.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre p-3 font-mono text-xs leading-relaxed text-foreground">
          {value}
        </pre>
      </div>
    )
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className="h-full min-h-0 w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
    />
  )
}
