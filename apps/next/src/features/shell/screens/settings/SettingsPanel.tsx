import { Button, Chip, ListBox, ScrollShadow, Select, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { signOut } from '@/core/session'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { useUiStore, type ThemePref } from '@/state/uiStore'
import { useActiveOrg } from '../../hooks/useActiveOrg'

// Settings panel screen — mounted when the Rail is in `settings` mode.
// Sections: Appearance (theme toggle), Language, Organization (if available), Account (email + sign out).
// All strings are inline English; no i18n changes needed.

const LANG_LABEL: Record<string, string> = { en: 'English', de: 'Deutsch' }

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
      {label}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  )
}

export function SettingsPanel() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const { currentOrg, user } = useActiveOrg()

  return (
    <section aria-label="Settings" className="flex h-full flex-col overflow-hidden bg-overlay/30">
      <ScrollShadow className="flex-1 overflow-y-auto py-1">

        {/* Appearance */}
        <SectionHeader label="Appearance" />
        <Row label="Theme">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([theme])}
            onSelectionChange={(keys) => {
              const next = [...keys][0]
              if (next) setTheme(next as ThemePref)
            }}
          >
            <ToggleButton isIconOnly id="light" aria-label="Light">
              <Sun className="size-4" />
            </ToggleButton>
            <ToggleButton isIconOnly id="dark" aria-label="Dark">
              <Moon className="size-4" />
            </ToggleButton>
            <ToggleButton isIconOnly id="system" aria-label="System">
              <Monitor className="size-4" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>

        {/* Language */}
        <SectionHeader label="Language" />
        <Row label="Language">
          <Select
            aria-label="Language"
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

        {/* Organization — only rendered when org is available */}
        {currentOrg && (
          <>
            <SectionHeader label="Organization" />
            <Row label="Name">
              <span className="truncate text-sm font-medium max-w-[160px]">{currentOrg.name}</span>
            </Row>
            {currentOrg.role && (
              <Row label="Role">
                <Chip size="sm" variant="soft">
                  {currentOrg.role}
                </Chip>
              </Row>
            )}
          </>
        )}

        {/* Account */}
        <SectionHeader label="Account" />
        {user?.email && (
          <Row label="Email">
            <span className="truncate text-sm max-w-[160px]">{user.email}</span>
          </Row>
        )}
        <div className="px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start text-danger"
            onPress={() => void signOut()}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>

      </ScrollShadow>
    </section>
  )
}
