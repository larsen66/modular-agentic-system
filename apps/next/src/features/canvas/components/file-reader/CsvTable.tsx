import { Table, Alert } from '@heroui/react'
import { useCanvasStrings } from '../../i18n'
import type { CsvTableProps } from '../../types/file-reader'

// CSV/TSV table view — HeroUI `Table` (a11y: first column is the row-number row header). Sticky
// header + scroll come from `Table.ScrollContainer`/`Table.Content` slots. NO custom CSS / raw
// <table> (legacy bug #5 fixed). Truncation → a warning Alert footer.

export function CsvTable({ table }: CsvTableProps) {
  const t = useCanvasStrings()
  const { rows, truncated, totalRows } = table

  if (rows.length === 0) {
    return <p className="p-4 text-sm text-muted">{t.fileReader.noRows}</p>
  }

  const [header, ...body] = rows
  const colCount = header.length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Table.ScrollContainer className="min-h-0 flex-1">
        <Table.Content aria-label={t.fileReader.tableLabel}>
          <Table.Header>
            <Table.Column isRowHeader>#</Table.Column>
            {header.map((cell, i) => (
              <Table.Column key={i}>{cell || `(${t.fileReader.columnPrefix} ${i + 1})`}</Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {body.map((cells, rowIdx) => (
              <Table.Row key={rowIdx}>
                <Table.Cell>{rowIdx + 1}</Table.Cell>
                {Array.from({ length: colCount }, (_, c) => (
                  <Table.Cell key={c}>{cells[c] ?? ''}</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {truncated ? (
        <div className="p-2">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                {t.fileReader.truncated
                  .replace('{shown}', String(body.length))
                  .replace('{total}', String(totalRows - 1))}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}
    </div>
  )
}
