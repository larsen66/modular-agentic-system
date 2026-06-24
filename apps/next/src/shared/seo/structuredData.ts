// schema.org JSON-LD builders for the SEO/AEO surface. Pure functions returning plain objects
// suitable for <Seo jsonLd={…}>. Keeping them here (not inline) lets pages compose structured
// data without hand-rolling schema.org boilerplate, and gives one place to validate against.

export const SITE_ORIGIN = 'https://bos.pro'

/**
 * BreadcrumbList for a multi-level page. Pass the trail from root to current page; the helper
 * fills `position` (1-based) and absolutizes relative paths against {@link SITE_ORIGIN}.
 * Helps SERP breadcrumb rendering and gives answer engines explicit page hierarchy.
 */
export function breadcrumbList(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.path.startsWith('http') ? item.path : `${SITE_ORIGIN}${item.path}`,
    })),
  }
}

/**
 * FAQPage structured data — answer engines (Google AI Overviews, Perplexity, ChatGPT) lift
 * these Q&A pairs directly into answers, so keep the text self-contained and factual.
 */
export function faqPage(qa: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}
