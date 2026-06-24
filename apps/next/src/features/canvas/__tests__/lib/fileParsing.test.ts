import { describe, expect, it } from 'vitest'
import {
  detectDelimiter,
  isTabularPath,
  languageForPath,
  parseDelimited,
  parseTable,
  MAX_TABLE_ROWS,
} from '@/features/canvas/lib/fileParsing'

describe('isTabularPath', () => {
  it('matches .csv and .tsv (case-insensitive)', () => {
    expect(isTabularPath('data/export.csv')).toBe(true)
    expect(isTabularPath('a.TSV')).toBe(true)
    expect(isTabularPath('src/App.tsx')).toBe(false)
  })
})

describe('detectDelimiter', () => {
  it('forces tab for .tsv regardless of content', () => {
    expect(detectDelimiter('a,b,c', 'x.tsv')).toBe('\t')
  })
  it('sniffs the most frequent delimiter on the first line', () => {
    expect(detectDelimiter('a;b;c\n1;2;3', 'x.csv')).toBe(';')
    expect(detectDelimiter('a,b,c', 'x.csv')).toBe(',')
  })
  it('ignores delimiters inside quotes and strips the BOM', () => {
    expect(detectDelimiter('﻿"a;b";c;d', 'x.csv')).toBe(';')
  })
  it('defaults to comma when nothing found', () => {
    expect(detectDelimiter('singlecolumn', 'x.csv')).toBe(',')
  })
})

describe('parseDelimited', () => {
  it('parses simple rows', () => {
    const out = parseDelimited('a,b\n1,2\n3,4', ',', 500)
    expect(out.rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
    expect(out.truncated).toBe(false)
  })
  it('handles quoted fields with embedded delimiter and newline', () => {
    const out = parseDelimited('name,note\n"Doe, J","line1\nline2"', ',', 500)
    expect(out.rows[1]).toEqual(['Doe, J', 'line1\nline2'])
  })
  it('handles doubled-quote escape', () => {
    const out = parseDelimited('q\n"say ""hi"""', ',', 500)
    expect(out.rows[1]).toEqual(['say "hi"'])
  })
  it('strips a BOM and tolerates no trailing newline', () => {
    const out = parseDelimited('﻿a,b\n1,2', ',', 500)
    expect(out.rows[0]).toEqual(['a', 'b'])
    expect(out.rows[1]).toEqual(['1', '2'])
  })
  it('tolerates CRLF line endings', () => {
    const out = parseDelimited('a,b\r\n1,2\r\n', ',', 500)
    expect(out.rows).toEqual([['a', 'b'], ['1', '2']])
  })
  it('flags truncation when rows exceed the cap', () => {
    const lines = ['h']
    for (let i = 0; i < 10; i++) lines.push(String(i))
    const out = parseDelimited(lines.join('\n'), ',', 3)
    expect(out.truncated).toBe(true)
    expect(out.totalRows).toBe(11)
    expect(out.rows.length).toBeLessThanOrEqual(4)
  })
})

describe('parseTable', () => {
  it('sniffs the delimiter and caps at MAX_TABLE_ROWS', () => {
    const out = parseTable('a;b\n1;2', 'x.csv')
    expect(out.delimiter).toBe(';')
    expect(out.rows).toEqual([['a', 'b'], ['1', '2']])
    expect(MAX_TABLE_ROWS).toBe(500)
  })
})

describe('languageForPath', () => {
  it('maps known extensions', () => {
    expect(languageForPath('a/b.tsx')).toBe('tsx')
    expect(languageForPath('x.py')).toBe('python')
    expect(languageForPath('data.yml')).toBe('yaml')
  })
  it('recognises Dockerfile by name', () => {
    expect(languageForPath('Dockerfile')).toBe('docker')
  })
  it('returns text for unknown/extensionless', () => {
    expect(languageForPath('LICENSE')).toBe('text')
    expect(languageForPath('weird.xyz')).toBe('text')
  })
})
