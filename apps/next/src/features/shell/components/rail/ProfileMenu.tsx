import type { ReactNode } from 'react'
import {
  Avatar,
  Button,
  Chip,
  ListBox,
  Popover,
  Select,
  Separator,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { LogOut, Monitor, Moon, Settings as SettingsIcon, Sun } from 'lucide-react'
import { signOut } from '@/core/session'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { useUiStore, type ThemePref } from '@/state/uiStore'
import { creditTone } from '../../hooks/useWalletBalance'
import { deriveInitials } from '../../hooks/useCurrentUser'
import { useShellStrings } from '../../i18n'
import type { CreditTone, ProfileMenuProps } from '../../types'
import { InviteCopyAction } from './InviteCopyAction'

// Profile / account popover. Simple, timeless: one identity block, then uniform one-line setting
// rows (label left / control right) and a short action list. Native HeroUI, no custom CSS.
const TONE_COLOR: Record<CreditTone, 'success' | 'warning' | 'danger'> = {
  ok: 'success',
  warning: 'warning',
  danger: 'danger',
}
const LANG_LABEL: Record<string, string> = { en: 'English', de: 'Deutsch' }

// One settings row: muted label on the left, control on the right. Each row is floored to a single
// height (min-h-10) and centered, so Organization / Theme / Language stay equally spaced even
// though their controls (text, toggle group, select) have different intrinsic heights.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  )
}

export function ProfileMenu({ user, currentOrg, balance, loading, disabled }: ProfileMenuProps) {
  const t = useShellStrings()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)

  if (loading || disabled) {
    return <Skeleton className="size-9 rounded-large" aria-label={t.rail.profile.label} />
  }

  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || 'User'

  return (
    <Popover>
      <Popover.Trigger aria-label={t.rail.profile.label}>
        <Button isIconOnly variant="ghost" size="md">
          <Avatar size="sm">
            <Avatar.Fallback>{deriveInitials(user)}</Avatar.Fallback>
          </Avatar>
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-72" placement="right bottom" shouldFlip={false} offset={20}>
        <Popover.Dialog>
          <div className="flex flex-col gap-3">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <Avatar size="md">
                <Avatar.Fallback>{deriveInitials(user)}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{name}</span>
                {user?.email && <span className="truncate text-xs text-muted">{user.email}</span>}
              </div>
            </div>

            <Separator />

            {/* Settings rows */}
            <div className="flex flex-col gap-3">
              {currentOrg && (
                <Row label={t.rail.profile.currentOrg}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm">{currentOrg.name}</span>
                    <Chip color={TONE_COLOR[creditTone(balance)]} size="sm" variant="soft">
                      {balance ?? 0}
                    </Chip>
                  </div>
                </Row>
              )}

              <Row label={t.rail.profile.theme}>
                <ToggleButtonGroup
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([theme])}
                  onSelectionChange={(keys) => {
                    const next = [...keys][0]
                    if (next) setTheme(next as ThemePref)
                  }}
                >
                  <ToggleButton isIconOnly id="light" aria-label={t.rail.profile.themeLight}>
                    <Sun className="size-4" />
                  </ToggleButton>
                  <ToggleButton isIconOnly id="dark" aria-label={t.rail.profile.themeDark}>
                    <Moon className="size-4" />
                  </ToggleButton>
                  <ToggleButton isIconOnly id="system" aria-label={t.rail.profile.themeSystem}>
                    <Monitor className="size-4" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Row>

              <Row label={t.rail.profile.language}>
                <Select
                  aria-label={t.rail.profile.language}
                  selectedKey={language}
                  onSelectionChange={(key) => {
                    if (key === 'en' || key === 'de') setLanguage(key)
                  }}
                  className="w-32"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {SUPPORTED_LANGUAGES.map((code) => (
                        <ListBox.Item key={code} id={code} textValue={LANG_LABEL[code]}>
                          {LANG_LABEL[code]}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Row>
            </div>

            <Separator />

            {/* Actions — all ghost boxes for an even rhythm; Sign out gets the danger token. */}
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onPress={() => {
                  // TODO: open personal Settings (Settings area not built yet).
                }}
              >
                <SettingsIcon className="size-4" /> {t.rail.profile.settings}
              </Button>
              <InviteCopyAction user={user} currentOrg={currentOrg} />
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-start text-danger"
                onPress={() => void signOut()}
              >
                <LogOut className="size-4" /> {t.rail.profile.signOut}
              </Button>
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
