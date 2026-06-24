import { describe, expect, it } from 'vitest'
import {
  statusChipColor,
  bucketChipColor,
  formatRunTime,
} from '@/features/canvas/components/history/runFormat'

describe('statusChipColor', () => {
  it('maps run status to a semantic chip color', () => {
    expect(statusChipColor('succeeded')).toBe('success')
    expect(statusChipColor('failed')).toBe('danger')
    expect(statusChipColor('running')).toBe('warning')
    expect(statusChipColor('started')).toBe('default')
  })
})

describe('bucketChipColor', () => {
  it('maps proposal bucket to a semantic chip color', () => {
    expect(bucketChipColor('completed')).toBe('success')
    expect(bucketChipColor('in_progress')).toBe('accent')
    expect(bucketChipColor('rejected')).toBe('danger')
    expect(bucketChipColor('notStarted')).toBe('default')
  })
})

describe('formatRunTime', () => {
  it('returns an em dash for null', () => {
    expect(formatRunTime(null)).toBe('—')
  })
  it('echoes an unparseable string', () => {
    expect(formatRunTime('not-a-date')).toBe('not-a-date')
  })
  it('formats a valid ISO timestamp', () => {
    expect(formatRunTime('2026-06-02T10:00:00Z', 'en-US')).toMatch(/2026/)
  })
})
