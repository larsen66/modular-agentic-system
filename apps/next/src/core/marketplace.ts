import { supabase } from './supabase'

// Marketplace-specific DB ops (thin adapters over the seam).
// Categories mirror the CHECK constraint in supabase/migrations (20260219100000, 20260402180000,
// 20260406100000, 20260528200000). Unknown/future values fall through as the raw string.

export type TemplateCategory =
  | 'crm'
  | 'support_desk'
  | 'productivity'
  | 'outreach'
  | 'operations'
  | 'other'
  | 'starter'
  | (string & {})

export interface MarketplaceTemplate {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: TemplateCategory
}

/** Fetch all published templates ordered by name. */
export async function fetchMarketplaceTemplates(): Promise<MarketplaceTemplate[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, description, icon, category')
    .eq('published', true)
    .order('name')
  if (error) throw new Error(`fetchMarketplaceTemplates failed: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    id: string
    name: string
    description: string | null
    icon: string | null
    category: string
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category as TemplateCategory,
  }))
}
