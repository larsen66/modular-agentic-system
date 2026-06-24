import type { Key } from 'react'
import {
  Alert,
  Button,
  Chip,
  CloseButton,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@heroui/react'
import { FileText, Pencil, Save, Table2, X } from 'lucide-react'
import { useCanvasStrings } from '../../i18n'
import type { FileToolbarProps } from '../../types/file-reader'

// The file-reader toolbar strip: left = filename Chip + muted path (truncate + Tooltip on the full
// path); right = state-swapped controls (read → Edit; editing → Cancel + Save + inline error; CSV →
// Table/Raw toggle) + transient "• updated" pulse. NO custom CSS. Button takes its icon as a child.

export function FileToolbar(props: FileToolbarProps) {
  const t = useCanvasStrings()
  const {
    name,
    path,
    tabular,
    viewMode,
    onViewModeChange,
    canEdit,
    editing,
    saving,
    liveUpdated,
    saveError,
    onEdit,
    onCancel,
    onSave,
    onDismissSaveError,
  } = props

  const onToggle = (keys: Set<Key>) => {
    const next = [...keys][0]
    if (next === 'table' || next === 'raw') onViewModeChange(next)
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Chip color="default" size="sm">{name}</Chip>
        <Tooltip delay={0}>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{path}</span>
          <Tooltip.Content>
            <p>{path}</p>
          </Tooltip.Content>
        </Tooltip>

        {tabular ? (
          <ToggleButtonGroup
            size="sm"
            selectionMode="single"
            selectedKeys={new Set([viewMode])}
            onSelectionChange={onToggle}
            aria-label={t.fileReader.viewToggle}
          >
            <ToggleButton id="table" aria-label={t.fileReader.tableView}>
              <Table2 className="size-3.5" /> {t.fileReader.tableView}
            </ToggleButton>
            <ToggleButton id="raw" aria-label={t.fileReader.rawView}>
              <FileText className="size-3.5" /> {t.fileReader.rawView}
            </ToggleButton>
          </ToggleButtonGroup>
        ) : null}

        {canEdit && !editing ? (
          <Tooltip delay={0}>
            <Button variant="secondary" size="sm" onPress={onEdit}>
              <Pencil className="size-3.5" /> {t.fileReader.edit}
            </Button>
            <Tooltip.Content>
              <p>{t.fileReader.editTip}</p>
            </Tooltip.Content>
          </Tooltip>
        ) : null}

        {editing ? (
          <>
            <Button variant="tertiary" size="sm" onPress={onCancel} isDisabled={saving}>
              <X className="size-3.5" /> {t.fileReader.cancel}
            </Button>
            <Button variant="primary" size="sm" onPress={onSave} isPending={saving} isDisabled={saving}>
              <Save className="size-3.5" /> {saving ? t.fileReader.saving : t.fileReader.save}
            </Button>
          </>
        ) : null}

        {liveUpdated && !editing ? (
          <Chip color="success" size="sm">{t.fileReader.updated}</Chip>
        ) : null}
      </div>

      {editing && saveError ? (
        <div className="px-3 pb-1.5">
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.fileReader.saveFailed}</Alert.Title>
              <Alert.Description>{saveError}</Alert.Description>
            </Alert.Content>
            <CloseButton onPress={onDismissSaveError} aria-label={t.fileReader.dismiss} />
          </Alert>
        </div>
      ) : null}

      <Separator />
    </div>
  )
}
