import { Table } from '@heroui/react'
import { useCanvasStrings } from '../../i18n'
import type { RunFilesTableProps } from '../../types/history'

// The per-file changed list inside the run-detail card: file · +adds · −dels. Pure presentation over
// the run's `enrichment.diff`. HeroUI Table + semantic tokens only (NO custom CSS).

export function RunFilesTable({ files }: RunFilesTableProps) {
  const t = useCanvasStrings()
  if (files.length === 0) {
    return <p className="text-sm text-muted">{t.history.detail.noFiles}</p>
  }
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={t.history.detail.filesTable}>
          <Table.Header>
            <Table.Column isRowHeader>{t.history.detail.colFile}</Table.Column>
            <Table.Column>{t.history.detail.colAdds}</Table.Column>
            <Table.Column>{t.history.detail.colDels}</Table.Column>
          </Table.Header>
          <Table.Body>
            {files.map((f) => (
              <Table.Row key={f.file}>
                <Table.Cell>{f.file}</Table.Cell>
                <Table.Cell>
                  <span className="text-success">+{f.additions}</span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-danger">−{f.deletions}</span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}
