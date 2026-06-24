import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, ScrollShadow } from '@heroui/react'
import {
  User, Palette, Bell, Shield, Plug, Building2,
  Users, Briefcase, KeyRound, BookOpen,
  CreditCard, FolderOpen, UsersRound,
} from 'lucide-react'
import { useActiveOrg } from '../../hooks/useActiveOrg'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  group: 'profile' | 'org' | 'workspace'
  section: string
  adminOnly?: boolean
}

const PROFILE_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: User, group: 'profile', section: 'profile' },
  { id: 'appearance', label: 'Appearance', icon: Palette, group: 'profile', section: 'appearance' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'profile', section: 'notifications' },
  { id: 'security', label: 'Security', icon: Shield, group: 'profile', section: 'security' },
  { id: 'connectors', label: 'Connectors', icon: Plug, group: 'profile', section: 'connectors' },
]

const ORG_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: Building2, group: 'org', section: 'general', adminOnly: true },
  { id: 'people', label: 'People', icon: Users, group: 'org', section: 'people' },
  { id: 'workspaces', label: 'Workspaces', icon: Briefcase, group: 'org', section: 'workspaces', adminOnly: true },
  { id: 'credentials', label: 'Credentials', icon: KeyRound, group: 'org', section: 'credentials', adminOnly: true },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, group: 'org', section: 'knowledge', adminOnly: true },
  // Usage + billing are one surface (BillingSection) — balance, usage breakdown, buy, plan, payment.
  { id: 'billing', label: 'Usage & billing', icon: CreditCard, group: 'org', section: 'billing', adminOnly: true },
]

const WS_ITEMS: NavItem[] = [
  { id: 'ws-general', label: 'General', icon: FolderOpen, group: 'workspace', section: 'ws-general' },
  { id: 'ws-members', label: 'Members', icon: UsersRound, group: 'workspace', section: 'ws-members' },
]

function resolveActiveSectionFromUrl(pathname: string, search: string): string {
  const sp = new URLSearchParams(search)
  const section = sp.get('section')
  // Usage folds into the billing surface — a ?section=usage deep-link highlights the billing item.
  if (section === 'usage') return 'billing'
  if (section) return section
  if (pathname.startsWith('/settings/org')) return 'general'
  if (pathname.startsWith('/settings/workspace')) return 'ws-general'
  return 'profile'
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pl-[12px] pr-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
      {label}
    </div>
  )
}

export function SettingsNavTree() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentOrg } = useActiveOrg()

  const activeSection = resolveActiveSectionFromUrl(location.pathname, location.search)
  const orgRole = currentOrg?.role ?? null
  const canManage = orgRole === 'owner' || orgRole === 'admin'

  const nav = useCallback((group: string, section: string) => {
    const path = group === 'org' ? '/settings/org' : group === 'workspace' ? '/settings/workspace' : '/settings/profile'
    navigate(`${path}?section=${section}`)
  }, [navigate])

  const isActive = (item: NavItem) => activeSection === item.section

  const visibleOrgItems = canManage
    ? ORG_ITEMS
    : ORG_ITEMS.filter((i) => !i.adminOnly)

  return (
    <section aria-label="Settings navigation" className="flex h-full flex-col overflow-hidden">
      <ScrollShadow className="flex-1 overflow-y-auto py-1">
        <div className="flex flex-col gap-1">
        <SectionHeader label="Profile" />
        {PROFILE_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={isActive(item)} onPress={() => nav(item.group, item.section)} />
        ))}

        {currentOrg && (
          <>
            <SectionHeader label={currentOrg.name ?? 'Organization'} />
            {visibleOrgItems.map((item) => (
              <NavButton key={item.id} item={item} active={isActive(item)} onPress={() => nav(item.group, item.section)} />
            ))}
          </>
        )}

        <SectionHeader label="Workspace" />
        {WS_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={isActive(item)} onPress={() => nav(item.group, item.section)} />
        ))}
        </div>
      </ScrollShadow>
    </section>
  )
}

function NavButton({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const Icon = item.icon
  return (
    <Button
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onPress={onPress}
      className={[
        'w-full justify-start rounded-xxl gap-1.5',
        active ? 'font-medium text-foreground' : 'font-light text-muted',
      ].join(' ')}
      style={{ paddingLeft: 12 }}
    >
      <Icon className="size-4 shrink-0 text-muted" />
      {item.label}
    </Button>
  )
}
