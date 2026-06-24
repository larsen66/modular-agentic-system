import type { ReactNode } from 'react'
import { QueryProvider } from './QueryProvider'
import { I18nProvider } from './I18nProvider'
import { ThemeProvider } from './ThemeProvider'
import { Seo } from '@/shared/seo/Seo'

// Default site-wide SEO/AEO head. Per-surface <Seo> overrides these by upserting the same tags.
const SITE_TITLE = 'BOS.PRO — Business Operating System'
const SITE_DESCRIPTION =
  'BOS.PRO is the Business Operating System — CRM, Tasks, Analytics, Finance, Support, and HR in one workspace, each powered by its own AI agent.'
const SITE_URL = 'https://bos.pro/'
const SITE_OG_IMAGE = 'https://bos.pro/og-image.png'
// hreflang alternates mirror the static set in index.html. Locale variants are served via the
// ?lng= query (i18n reads it); x-default falls back to English. Extend as locale-routed
// marketing pages land.
const SITE_ALTERNATES = [
  { hreflang: 'en', href: 'https://bos.pro/' },
  { hreflang: 'de', href: 'https://bos.pro/?lng=de' },
  { hreflang: 'x-default', href: 'https://bos.pro/' },
]

// Composes all global providers in one place, outermost → innermost. Add a new global provider
// by creating its file here and slotting it into this tree — surfaces never re-declare providers.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <I18nProvider>
        <ThemeProvider>
          <Seo
            title={SITE_TITLE}
            description={SITE_DESCRIPTION}
            canonical={SITE_URL}
            ogImage={SITE_OG_IMAGE}
            locale="en_US"
            alternates={SITE_ALTERNATES}
          />
          {children}
        </ThemeProvider>
      </I18nProvider>
    </QueryProvider>
  )
}
