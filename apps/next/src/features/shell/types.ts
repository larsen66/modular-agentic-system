import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Organization } from '@/core/orgs'
import type { Workspace } from '@/core/workspaces'

// Single types surface for the shell feature module (ARCHITECTURE §3): the module's shared/domain
// types plus its component prop contracts. Seam + cross-cutting types are re-exported here so
// consumers import shell types from one place.
//
// NOTE: `RailMode` is DEFINED in `src/state/uiStore` (cross-cutting UI state read by the Explorer
// area later) — a lower layer than features, so it cannot live here without inverting the
// dependency direction. We re-export it for a single feature-facing types surface.
export type { RailMode, ExplorerView } from '@/state/uiStore'
export type { Organization } from '@/core/orgs'
export type { Workspace } from '@/core/workspaces'
export type { ProjectNode, ChatNode } from '@/core/explorer'

// ── Domain ──

/** Current signed-in user + first-resolution flag (drives the Rail readiness gate). */
export interface CurrentUser {
  user: User | null
  loading: boolean
}

/** Credit-balance emphasis bucket → maps to a semantic token. */
export type CreditTone = 'danger' | 'warning' | 'ok'

// ── Component props ──

export interface RailButtonProps {
  icon: ReactNode
  label: ReactNode
  active?: boolean
  isDisabled?: boolean
  onPress?: () => void
  /** Tooltip body override (e.g. label + Kbd). Defaults to `label`. */
  tooltip?: ReactNode
  'aria-label': string
}

export interface OrgSwitcherProps {
  orgs: Organization[]
  /** All workspaces across the user's orgs; the switcher scopes them per org. */
  workspaces: Workspace[]
  currentOrg: Organization | null
  currentWorkspaceId: string | null
  loading: boolean
  disabled: boolean
  /** Admin affordances (create org/workspace, org-management nav) — owner/admin only. */
  canManage: boolean
  /** Switch the active scope to a workspace (and, implicitly, its org). */
  onSwitchWorkspace: (orgId: string, workspaceId: string) => void
  /** Create a workspace in an org. Resolves on success; rejects to surface an inline error. */
  onCreateWorkspace: (orgId: string, name: string) => Promise<void>
  /** Create an org (+ seed workspace) and switch to it. Resolves on success; rejects on error. */
  onCreateOrganization: (name: string) => Promise<void>
  onOpenOrgSettings: () => void
  onOpenPeople: () => void
  onOpenBilling: () => void
}

/** Where the Credits & Billing popover routes; targets open the Billing area (not built yet). */
export type BillingTarget = 'buy' | 'plans' | 'usage'

export interface CreditsReadoutProps {
  balance: number | null | undefined
  loading: boolean
  disabled: boolean
  orgName: string | null
  /** Opens the Billing area at the given target. No-op until Billing is built. */
  onOpenBilling: (target?: BillingTarget) => void
}

export interface ProfileMenuProps {
  user: User | null
  currentOrg: Organization | null
  balance: number | null | undefined
  loading: boolean
  disabled: boolean
}

export interface InviteModalProps {
  user: User | null
  currentOrg: Organization | null
  disabled?: boolean
  /** Custom trigger (e.g. a profile menu row). Defaults to the rail's icon-only Gift button. */
  trigger?: ReactNode
}

// ── Explorer component props ──

/** One generic tree row: a split control — a chevron disclosure button beside the item button. */
export interface NodeRowProps {
  icon: ReactNode
  label: string
  /** Disambiguating suffix (e.g. a duplicate-name marker). */
  labelSuffix?: string | null
  selected?: boolean
  /** Workspace row only: a descendant is selected — show the ancestor-active indicator. */
  ancestorActive?: boolean
  /** Chat leaf rows: parent handles the animated dot — suppress the static one. */
  suppressDot?: boolean
  /** Indentation depth (0 = workspace, 1 = project, 2 = chat). */
  depth?: number
  /** Branch rows pass their expanded state → a leading chevron indicator + `aria-expanded`. */
  expanded?: boolean
  /** Pressing the item — selects and/or toggles the branch (the caller decides). */
  onPress?: () => void
  // Trailing controls — rendered as custom (no-hover) buttons INSIDE the item, so hovering or
  // clicking them never drops the row's hover. Config (not JSX) so the row owns the open state.
  /** Renders a "+" create button; called on press. */
  onCreate?: () => void
  createLabel?: string
  /** Renders a "⋯" menu (HeroUI Dropdown) with these items. */
  menuItems?: NodeMenuItem[]
  onMenuAction?: (id: string) => void
  'aria-label'?: string
}

/** One item in a node's "⋯" edit menu. */
export interface NodeMenuItem {
  id: string
  label: string
  /** Renders with the danger token (e.g. Delete). */
  danger?: boolean
}

export interface NodeMenuProps {
  /** Node label — used to build the trigger's accessible name. */
  label: string
  items: NodeMenuItem[]
  onAction: (id: string) => void
  /** Controlled open state so the row can stay highlighted while the menu is open. */
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

/** Honest empty / loading / error / unavailable state for the Explorer body. */
export interface ExplorerEmptyStateProps {
  message: string
  /** When set, renders a retry button (error states). */
  onRetry?: () => void
  retryLabel?: string
}

/** Read-only referral link + copy button (shared by the Invite popover and the Profile menu). */
export interface ReferralLinkProps {
  link: string | null
  loading: boolean
}

/** Profile-menu "Invite & earn credits" action: copies the referral link + inline confirm popover. */
export interface InviteCopyActionProps {
  user: User | null
  currentOrg: Organization | null
}
