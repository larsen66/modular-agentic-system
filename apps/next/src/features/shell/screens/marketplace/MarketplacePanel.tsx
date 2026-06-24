import { Store } from 'lucide-react'

// MarketplacePanel — minimal Explorer panel shown in the left rail when
// activeMode === 'marketplace'. The Stage area renders the full MarketplacePage
// as a takeover (like Settings), so this panel is intentionally lightweight —
// just a heading and a description to orient the user.
export function MarketplacePanel() {
  return (
    <section
      aria-label="Marketplace"
      className="flex h-full flex-col overflow-hidden p-3"
    >
      <div className="flex flex-col items-center gap-3 px-2 pt-8 pb-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-default-100">
          <Store className="h-6 w-6 text-default-500" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Marketplace</h2>
          <p className="text-xs text-default-400">
            Discover and install template projects.
          </p>
        </div>
      </div>
    </section>
  )
}
