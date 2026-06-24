import { useMemo, type ComponentType } from 'react'
import { Chip } from '@heroui/react'
import { FileDiff as FileDiffRaw, parseDiffFromFile, type FileContents } from '@pierre/diffs'
import { useDiffStrings } from './diffStrings'
import { diffTheme } from './diffTheme'
import type { DiffFileBodyProps } from '../../types/diff'

// `@pierre/diffs` ships its React types against a different React copy, so its `FileDiff` doesn't
// line up with our React 19 JSX element type (TS2786/2607). It IS a valid component at runtime — cast
// it to a local component type so JSX accepts it without leaking `any` into the rest of the file.
const FileDiff = FileDiffRaw as unknown as ComponentType<{
  fileDiff: ReturnType<typeof parseDiffFromFile>
  options: { diffStyle: string; disableFileHeader: boolean; theme: typeof diffTheme }
}>

// THE ONLY non-HeroUI render in the diff screen — the thin wrapper that owns the 3rd-party
// `@pierre/diffs` renderer (design §3 "How @pierre/diffs is wrapped"). HeroUI governs ALL chrome
// (file header, list, toggle) and never reaches into this body. We feed old/new `FileContents`; the
// library computes hunks itself (`parseDiffFromFile`) — we do NOT hand-parse patches. The library's
// own file header is suppressed (`disableFileHeader: true`) because HeroUI owns the `Disclosure`
// header. Theme = the shared CSS-variables theme → HeroUI-token-driven colors, no bespoke hex.

export function DiffFileBody({ file, diffStyle }: DiffFileBodyProps) {
  const t = useDiffStrings()

  // Content-unavailable (binary / too-large / not-enriched) → header-only; no renderer mount.
  const unavailable = file.oldContents === null || file.newContents === null

  const fileDiff = useMemo(() => {
    if (unavailable) return null
    const oldFile: FileContents = {
      name: file.prevPath ?? file.path,
      contents: file.oldContents ?? '',
      // Cache key keyed on path+side so toggling unified/split or re-expanding reuses tokenization.
      cacheKey: `old:${file.prevPath ?? file.path}`,
    }
    const newFile: FileContents = {
      name: file.path,
      contents: file.newContents ?? '',
      cacheKey: `new:${file.path}`,
    }
    return parseDiffFromFile(oldFile, newFile)
  }, [unavailable, file.path, file.prevPath, file.oldContents, file.newContents])

  if (unavailable || !fileDiff) {
    return (
      <div className="flex items-center justify-center p-4">
        <Chip size="sm" variant="soft">{t.contentUnavailable}</Chip>
      </div>
    )
  }

  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle,
        disableFileHeader: true,
        theme: diffTheme,
      }}
    />
  )
}
