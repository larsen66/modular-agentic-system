import { History } from 'lucide-react'
import { DegradedStatePanel } from '@/shared/DegradedStatePanel'
import { useCanvasStrings } from '../../i18n'

// The "no runs yet" empty state — runs appear here after the agent makes changes. Reuses the shared
// canvas degraded/empty panel (AREA §5) so history matches preview/child-mount empties. NO custom CSS.

export function HistoryEmptyState() {
  const t = useCanvasStrings()
  return (
    <DegradedStatePanel
      icon={<History className="size-8" />}
      title={t.history.empty.title}
      description={t.history.empty.description}
    />
  )
}
