import { Avatar, Button, Chip, Description, Label, ListBox, ScrollShadow, Skeleton } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchOrgMembers } from '@/core/orgs'
import { useActiveOrg } from '../../hooks/useActiveOrg'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

function roleColor(role: string | null): 'danger' | 'warning' | 'default' {
  if (role === 'owner') return 'danger'
  if (role === 'admin') return 'warning'
  return 'default'
}

export function PeoplePanel() {
  const { currentOrg } = useActiveOrg()
  const orgId = currentOrg?.id ?? null
  const navigate = useNavigate()

  const { data: members, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => fetchOrgMembers(orgId!),
    enabled: orgId != null,
  })

  return (
    <section aria-label="People" className="flex h-full flex-col overflow-hidden">

      {/* Invite CTA */}
      <div className="shrink-0 pb-2">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onPress={() => navigate('/settings/org?section=people')}
        >
          Invite teammate
        </Button>
      </div>

      <ScrollShadow className="min-h-0 flex-1">

        {/* Loading skeletons */}
        {(isLoading || orgId == null) && (
          <div className="flex flex-col gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-2.5 w-36 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-xs text-danger">
              {error instanceof Error ? error.message : 'Failed to load members'}
            </p>
            <Button size="sm" variant="ghost" onPress={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && (members?.length ?? 0) === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted">No members yet</p>
        )}

        {/* Member list via HeroUI ListBox */}
        {!isLoading && !isError && (members?.length ?? 0) > 0 && (
          <ListBox
            aria-label="Team members"
            selectionMode="none"
            className="w-full p-0"
          >
            {(members ?? []).map((member) => {
              const displayName = member.fullName ?? member.email ?? 'Unknown'
              const initials = displayName
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              return (
                <ListBox.Item key={member.id} id={member.id} textValue={displayName} className="overflow-hidden">
                  <Avatar size="sm">
                    {member.avatarUrl && (
                      <Avatar.Image src={member.avatarUrl} alt={displayName} />
                    )}
                    <Avatar.Fallback>{initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <Label className="block w-full truncate text-sm">{displayName}</Label>
                    {member.email && (
                      <Description className="block w-full truncate text-xs">{member.email}</Description>
                    )}
                  </div>
                  <Chip size="sm" variant="soft" color={roleColor(member.role)} className="shrink-0">
                    <Chip.Label>{ROLE_LABELS[member.role ?? ''] ?? 'Member'}</Chip.Label>
                  </Chip>
                </ListBox.Item>
              )
            })}
          </ListBox>
        )}

      </ScrollShadow>

    </section>
  )
}
