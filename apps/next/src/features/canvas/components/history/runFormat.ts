import type { RunStatus, ProposalBucket } from '../../types/history'

// Pure presentation helpers for the history screen — status/bucket → HeroUI semantic Chip color, and
// a tolerant timestamp formatter. No custom CSS; these only pick semantic tokens / format strings.

export type ChipColor = 'success' | 'danger' | 'warning' | 'default' | 'accent'

/** Run status → Chip color (success/danger/warning/default). */
export function statusChipColor(status: RunStatus): ChipColor {
  switch (status) {
    case 'succeeded':
      return 'success'
    case 'failed':
      return 'danger'
    case 'running':
      return 'warning'
    default:
      return 'default'
  }
}

/** Proposal bucket → Chip color (only shown for runs that produced a governed proposal). */
export function bucketChipColor(bucket: ProposalBucket): ChipColor {
  switch (bucket) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'accent'
    case 'rejected':
      return 'danger'
    default:
      return 'default'
  }
}

/** Format an ISO timestamp for display; null → em dash. Tolerant of bad input. */
export function formatRunTime(iso: string | null, locale?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return d.toISOString()
  }
}
