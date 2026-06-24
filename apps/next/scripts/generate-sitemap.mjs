#!/usr/bin/env node
// Build-time sitemap generator. Runs via the `prebuild` npm hook so public/sitemap.xml can
// never drift from the public route table as marketing pages are added — edit PUBLIC_ROUTES
// here, not the generated XML.
//
// Only genuinely public (non-AuthGuard) routes belong here. Everything under /project,
// /settings, /marketplace is auth-gated and Disallow-ed in robots.txt, so it is intentionally
// excluded. Each entry also emits xhtml:link hreflang alternates for the supported locales
// (locale variants served via the ?lng= query; x-default → English).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ORIGIN = 'https://bos.pro'
const LOCALES = ['en', 'de'] // keep in sync with src/i18n/config.ts SUPPORTED_LANGUAGES

/** @type {Array<{ path: string, changefreq: string, priority: string }>} */
const PUBLIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
]

const lastmod = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

function localeHref(path, locale) {
  const url = `${ORIGIN}${path}`
  return locale === 'en' ? url : `${url}${path.includes('?') ? '&' : '?'}lng=${locale}`
}

function urlEntry({ path, changefreq, priority }) {
  const alternates = [...LOCALES, 'x-default']
    .map((loc) => {
      const hreflang = loc === 'x-default' ? 'x-default' : loc
      const href = loc === 'x-default' ? `${ORIGIN}${path}` : localeHref(path, loc)
      return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`
    })
    .join('\n')
  return `  <url>
    <loc>${ORIGIN}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${PUBLIC_ROUTES.map(urlEntry).join('\n')}
</urlset>
`

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml')
writeFileSync(out, xml)
console.log(`[generate-sitemap] wrote ${PUBLIC_ROUTES.length} url(s) → ${out}`)
