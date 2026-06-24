import { useEffect } from 'react'

// Dependency-free SEO/AEO head manager. No react-helmet — a single effect upserts the
// document title, the canonical meta/link tags, OpenGraph + Twitter cards, hreflang
// alternates, and (optionally) one or more JSON-LD <script>s. SPA-safe: mirrors
// ThemeProvider's pattern (effect on render, returns null). On unmount/change it removes the
// per-route nodes it injected (JSON-LD scripts + hreflang links) so structured data and
// locale alternates never leak across navigations.
export interface SeoAlternate {
  /** BCP-47 language tag, e.g. "en", "de", or "x-default". */
  hreflang: string
  /** Absolute URL for this locale variant. */
  href: string
}

export interface SeoProps {
  /** Document title. Becomes <title>, og:title, twitter:title. */
  title?: string
  /** Meta description. Becomes <meta name=description>, og:description, twitter:description. */
  description?: string
  /** Absolute canonical URL for this surface. Becomes <link rel=canonical> + og:url. */
  canonical?: string
  /** Absolute URL to the share image (1200×630). Becomes og:image, twitter:image. */
  ogImage?: string
  /** OpenGraph locale, e.g. "en_US". Also sets <html lang> to the leading subtag. */
  locale?: string
  /** hreflang alternates. Emits <link rel=alternate hreflang> per entry (cleaned up on change). */
  alternates?: SeoAlternate[]
  /** When true, emits <meta name=robots content="noindex,nofollow">. */
  noindex?: boolean
  /**
   * Structured data (schema.org). One object → one JSON-LD <script>; an array → one script
   * per entry. All injected scripts are cleaned up on change/unmount.
   */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

// Upserts <meta> by `name` or `property`. Marks managed tags with data-seo so we never
// clobber the static tags baked into index.html.
function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    el.setAttribute('data-seo', '')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function Seo({ title, description, canonical, ogImage, locale, alternates, noindex, jsonLd }: SeoProps) {
  useEffect(() => {
    if (title) {
      document.title = title
      upsertMeta('property', 'og:title', title)
      upsertMeta('name', 'twitter:title', title)
    }
    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
      upsertMeta('name', 'twitter:description', description)
    }
    if (canonical) {
      upsertLink('canonical', canonical)
      upsertMeta('property', 'og:url', canonical)
    }
    if (ogImage) {
      upsertMeta('property', 'og:image', ogImage)
      upsertMeta('name', 'twitter:image', ogImage)
    }
    if (locale) {
      upsertMeta('property', 'og:locale', locale)
      document.documentElement.setAttribute('lang', locale.split(/[_-]/)[0])
    }
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow')

    // hreflang alternates — created fresh each pass and removed on cleanup (they are
    // per-route and must not accumulate across navigations).
    const altEls: HTMLLinkElement[] = []
    for (const alt of alternates ?? []) {
      const el = document.createElement('link')
      el.setAttribute('rel', 'alternate')
      el.setAttribute('hreflang', alt.hreflang)
      el.setAttribute('href', alt.href)
      el.setAttribute('data-seo-alt', '')
      document.head.appendChild(el)
      altEls.push(el)
    }

    // JSON-LD — one script per object; removed on change/unmount.
    const scripts: HTMLScriptElement[] = []
    if (jsonLd) {
      for (const block of Array.isArray(jsonLd) ? jsonLd : [jsonLd]) {
        const el = document.createElement('script')
        el.type = 'application/ld+json'
        el.setAttribute('data-seo', '')
        el.textContent = JSON.stringify(block)
        document.head.appendChild(el)
        scripts.push(el)
      }
    }

    // Cleanup the per-route nodes. meta/link[rel=canonical] are idempotent upserts left in
    // place to be overwritten by the next Seo; JSON-LD + hreflang alternates are removed.
    return () => {
      for (const el of scripts) el.parentNode?.removeChild(el)
      for (const el of altEls) el.parentNode?.removeChild(el)
    }
  }, [title, description, canonical, ogImage, locale, alternates, noindex, jsonLd])

  return null
}
