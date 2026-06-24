import { Alert, Spinner } from '@heroui/react'
import { FileQuestion } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { useFileContent } from '../../hooks/useFileContent'
import { languageForPath } from '../../lib/fileParsing'
import { useCanvasStrings } from '../../i18n'
import { FileToolbar } from '../../components/file-reader/FileToolbar'
import { CodeView } from '../../components/file-reader/CodeView'
import { CsvTable } from '../../components/file-reader/CsvTable'
import { FileEditView } from '../../components/file-reader/FileEditView'
import type { FileReaderProps } from '../../types/file-reader'

// The file-reader screen — composition only. Wires `useFileContent` + the building blocks into the
// vertical-fill layout (toolbar strip · separator · content region rendering exactly one of:
// spinner / error / empty / code / table / editor). Hosted by `canvas-shell` for `file:` tabs.

// editable Monaco/textarea path is gated until an editor dep is wired (FileEditView dep flag).
const EDITABLE_AVAILABLE = true

export function FileReaderScreen({
  path,
  name,
  rootId,
  sessionId = null,
  projectId = null,
  codeAuthority,
}: FileReaderProps) {
  const t = useCanvasStrings()
  const fc = useFileContent({ sessionId, projectId, path, rootId, codeAuthority })
  const language = languageForPath(path)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <FileToolbar
        name={name}
        path={path}
        tabular={fc.tabular}
        viewMode={fc.viewMode}
        onViewModeChange={fc.setViewMode}
        canEdit={fc.canEdit}
        editing={fc.editing}
        saving={fc.saving}
        liveUpdated={fc.liveUpdated}
        saveError={fc.saveError}
        onEdit={fc.enterEdit}
        onCancel={fc.cancelEdit}
        onSave={fc.save}
        onDismissSaveError={fc.dismissSaveError}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {!sessionId ? (
          <DegradedStatePanel
            icon={<FileQuestion className="size-8" />}
            title={t.fileReader.noSession.title}
            description={t.fileReader.noSession.description}
          />
        ) : fc.loading ? (
          <div className="flex h-full min-h-0 items-center justify-center gap-2 p-8 text-sm text-muted">
            <Spinner size="sm" />
            <span>{t.fileReader.loading.replace('{name}', name)}</span>
          </div>
        ) : fc.error ? (
          <div className="p-4">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.fileReader.readFailed}</Alert.Title>
                <Alert.Description>{fc.error}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        ) : fc.editing ? (
          <FileEditView
            value={fc.editContent}
            onChange={fc.setEditContent}
            language={language}
            readOnly={!EDITABLE_AVAILABLE}
          />
        ) : fc.content === '' ? (
          <p className="p-4 text-sm text-muted">{t.fileReader.empty}</p>
        ) : fc.table ? (
          <CsvTable table={fc.table} />
        ) : (
          <CodeView content={fc.content} language={language} />
        )}
      </div>
    </div>
  )
}
