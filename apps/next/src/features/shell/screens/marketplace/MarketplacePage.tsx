import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Chip, Input, ScrollShadow, Spinner } from '@heroui/react'
import {
  Users,
  HeadphonesIcon,
  Zap,
  Megaphone,
  Settings2,
  LayoutTemplate,
  Rocket,
} from 'lucide-react'
import {
  fetchMarketplaceTemplates,
  type MarketplaceTemplate,
  type TemplateCategory,
} from '@/core/marketplace'

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  support_desk: 'Support',
  productivity: 'Productivity',
  outreach: 'Outreach',
  operations: 'Operations',
  other: 'Other',
  starter: 'Starter',
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  crm: Users,
  support_desk: HeadphonesIcon,
  productivity: Zap,
  outreach: Megaphone,
  operations: Settings2,
  starter: Rocket,
}

export function MarketplacePage() {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    fetchMarketplaceTemplates()
      .then((rows) => { if (!cancelled) setTemplates(rows) })
      .catch((err: unknown) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const categories = useMemo<TemplateCategory[]>(() => {
    const seen = new Set<TemplateCategory>()
    for (const t of templates) seen.add(t.category)
    return Array.from(seen).sort()
  }, [templates])

  const filtered = useMemo<MarketplaceTemplate[]>(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (CATEGORY_LABELS[t.category] ?? t.category).toLowerCase().includes(q)
      )
    })
  }, [templates, search, activeCategory])

  return (
    <ScrollShadow className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-base font-semibold text-foreground">Marketplace</h1>
          <p className="mt-0.5 text-sm text-muted">Ready-to-use project templates</p>
        </div>

        {/* Search */}
        <Input
          aria-label="Search templates"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          variant="secondary"
          fullWidth
          className="mb-4"
        />

        {/* Category filters — only when data has >1 category */}
        {!loading && categories.length > 1 && (
          <div className="mb-5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeCategory === 'all' ? 'primary' : 'ghost'}
              onPress={() => setActiveCategory('all')}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? 'primary' : 'ghost'}
                onPress={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </Button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {/* Error */}
        {!loading && fetchError && (
          <p className="py-4 text-sm text-danger">{fetchError}</p>
        )}

        {/* Empty */}
        {!loading && !fetchError && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            {templates.length === 0
              ? 'No templates published yet.'
              : 'No templates match your search.'}
          </p>
        )}

        {/* Template list */}
        {!loading && !fetchError && filtered.length > 0 && (
          <div className="flex flex-col gap-2">
            {filtered.map((template) => (
              <Card key={template.id} variant="default">
                <Card.Header className="flex-row items-center gap-4">
                  {(() => {
                    const Icon = CATEGORY_ICONS[template.category] ?? LayoutTemplate
                    return (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-default-100">
                        <Icon className="h-4 w-4 text-default-500" aria-hidden="true" />
                      </div>
                    )
                  })()}
                  <div className="min-w-0 flex-1">
                    <Card.Title className="text-sm">{template.name}</Card.Title>
                    {template.description && (
                      <Card.Description className="line-clamp-1 text-xs">
                        {template.description}
                      </Card.Description>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip size="sm" variant="soft">
                      <Chip.Label>
                        {CATEGORY_LABELS[template.category] ?? template.category}
                      </Chip.Label>
                    </Chip>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => navigate(`/project/${template.id}`)}
                    >
                      Open
                    </Button>
                  </div>
                </Card.Header>
              </Card>
            ))}
          </div>
        )}

      </div>
    </ScrollShadow>
  )
}
