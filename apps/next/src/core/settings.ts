import { supabase } from './supabase'

// Settings-specific DB ops (thin adapters over the seam). All reads use the same RLS paths
// already proven in the legacy OrgSettings/SettingsCanvas/PersonalSettings implementation.

export interface OrgInvitation {
  id: string
  invitedEmail: string
  role: string
  token: string
  expiresAt: string
  createdAt: string
  workspaceId: string
  workspaceName: string | null
}

export interface OrgWorkspace {
  id: string
  name: string
}

export interface WorkspaceMember {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
  role: string | null
}

export interface WsGeneralInfo {
  id: string
  name: string
  description: string | null
}

export interface OrgGeneralInfo {
  id: string
  name: string
  slug: string | null
  description: string | null
}

export interface UserProfile {
  id: string
  fullName: string | null
  email: string | null
  avatarUrl: string | null
}

export interface OrgNodeVisibility {
  visibilityMode: string
  isRootLanding: boolean
}

export interface OrgRunVisibility {
  workspaceRunVisibility: boolean
}

export interface OrgMemberRoleDefaults {
  defaultMemberRole: string
  allowSelfRegistration: boolean
}

export interface UserPreferences {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  theme: string
  language: string
  aiModel: string
  responseStyle: string
  personalAiInstructions: string
  notificationMode: string
}

export interface OrgUsageSummaryRow {
  orgId: string
  userId: string
  day: string
  model: string | null
  provider: string | null
  runCount: number
  totalInputTokens: number | null
  totalOutputTokens: number | null
  totalCost: number | null
  lastRunAt: string
}

export interface OrgBillingProfile {
  orgId: string
  stripeCustomerId: string | null
  billingEmail: string | null
  billingContactName: string | null
  defaultFundingPolicy: string
  allowPersonalProvider: boolean
  managedByOrgId: string | null
  serviceFeeRate: number
}

export interface OrgBillingEvent {
  id: string
  orgId: string
  eventType: string
  credits: number
  baseCostUsd: number
  occurredAt: string
}

export interface ResolvedProfile {
  id: string
  email: string | null
  fullName: string | null
}

/** Fetch profile for the current signed-in user. */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(`fetchUserProfile failed: ${error.message}`)
  if (!data) return null
  const row = data as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }
  return { id: row.id, fullName: row.full_name, email: row.email, avatarUrl: row.avatar_url }
}

/** Update the display name for the current user. */
export async function updateUserFullName(userId: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
  if (error) throw new Error(`updateUserFullName failed: ${error.message}`)
}

/** Fetch org general info (name, slug, description). */
export async function fetchOrgGeneralInfo(orgId: string): Promise<OrgGeneralInfo | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, description')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw new Error(`fetchOrgGeneralInfo failed: ${error.message}`)
  if (!data) return null
  const row = data as { id: string; name: string; slug: string | null; description: string | null }
  return { id: row.id, name: row.name, slug: row.slug, description: row.description }
}

/** Save org general info (name + description). Slug update is a separate RPC. */
export async function saveOrgGeneralInfo(orgId: string, updates: { name?: string; description?: string }): Promise<void> {
  if (Object.keys(updates).length === 0) return
  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
  if (error) throw new Error(`saveOrgGeneralInfo failed: ${error.message}`)
}

// NOTE: No organizations.timezone column exists in the schema as of the current migrations.
// saveOrgTimezone is intentionally omitted — add it once the column migration lands.

/** Fetch the org node visibility + is_root_landing flag from the nodes table. */
export async function fetchRootLandingStatus(orgId: string): Promise<OrgNodeVisibility | null> {
  const { data, error } = await supabase
    .from('nodes')
    .select('visibility_mode, is_root_landing')
    .eq('id', orgId)
    .eq('kind', 'org')
    .maybeSingle()
  if (error) throw new Error(`fetchRootLandingStatus failed: ${error.message}`)
  if (!data) return null
  const row = data as { visibility_mode: string; is_root_landing: boolean }
  return { visibilityMode: row.visibility_mode, isRootLanding: row.is_root_landing }
}

/**
 * Promote this org as the bos.pro root landing org, or demote it if enabled=false.
 * Uses the publish_root_landing_org RPC (only works when org visibility_mode='public').
 * Pass currentRootOrgId to guard against concurrent publication races.
 */
export async function setRootLanding(
  orgId: string,
  enabled: boolean,
  currentRootOrgId?: string | null,
): Promise<void> {
  if (!enabled) {
    // Demote: clear the flag directly via nodes UPDATE (org admin/owner RLS allows this).
    const { error } = await supabase
      .from('nodes')
      .update({ is_root_landing: false })
      .eq('id', orgId)
      .eq('kind', 'org')
    if (error) throw new Error(`setRootLanding (demote) failed: ${error.message}`)
    return
  }
  // Promote via the SECURITY DEFINER RPC that enforces the public-visibility constraint
  // and the single-root advisory lock.
  const { error } = await supabase.rpc(
    'publish_root_landing_org' as never,
    {
      p_org_node_id: orgId,
      p_expected_root_org_id: currentRootOrgId ?? null,
    } as never,
  )
  if (error) throw new Error(`setRootLanding (promote) failed: ${error.message}`)
}

/** Fetch the workspace_run_visibility toggle from org_settings. Returns false if no row. */
export async function fetchOrgRunVisibility(orgId: string): Promise<OrgRunVisibility> {
  const { data, error } = await supabase
    .from('org_settings')
    .select('workspace_run_visibility')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(`fetchOrgRunVisibility failed: ${error.message}`)
  const row = data as { workspace_run_visibility: boolean } | null
  return { workspaceRunVisibility: row?.workspace_run_visibility ?? false }
}

/** Upsert the workspace_run_visibility toggle in org_settings. */
export async function saveOrgRunVisibility(orgId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('org_settings')
    .upsert({ org_id: orgId, workspace_run_visibility: enabled }, { onConflict: 'org_id' })
  if (error) throw new Error(`saveOrgRunVisibility failed: ${error.message}`)
}

/** Fetch all pending invitations for an org (across all its workspaces). */
export async function fetchOrgInvitations(orgId: string): Promise<OrgInvitation[]> {
  const { data: workspaces, error: wsErr } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', orgId)
  if (wsErr) throw new Error(`fetchOrgInvitations (workspaces) failed: ${wsErr.message}`)

  const wsList = (workspaces ?? []) as { id: string; name: string }[]
  if (wsList.length === 0) return []

  const wsIds = wsList.map((w) => w.id)
  const nameById = Object.fromEntries(wsList.map((w) => [w.id, w.name]))

  const { data, error } = await supabase
    .from('workspace_invitations')
    .select('id, invited_email, role, token, expires_at, created_at, workspace_id')
    .in('workspace_id', wsIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`fetchOrgInvitations failed: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    id: string
    invited_email: string
    role: string
    token: string
    expires_at: string
    created_at: string
    workspace_id: string
  }>).map((row) => ({
    id: row.id,
    invitedEmail: row.invited_email,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    workspaceId: row.workspace_id,
    workspaceName: nameById[row.workspace_id] ?? null,
  }))
}

/** Fetch all workspaces in an org. */
export async function fetchOrgWorkspaces(orgId: string): Promise<OrgWorkspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', orgId)
  if (error) throw new Error(`fetchOrgWorkspaces failed: ${error.message}`)
  return ((data ?? []) as { id: string; name: string }[])
}

/** Fetch workspace-scoped members (direct_workspace source_kind). */
export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from('node_memberships')
    .select('principal_id, role_key, principals(email, display_name, avatar_url)')
    .eq('node_id', workspaceId)
    .eq('source_kind', 'direct_workspace')
  if (error) throw new Error(`fetchWorkspaceMembers failed: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    principal_id: string
    role_key: string | null
    principals: { email: string | null; display_name: string | null; avatar_url: string | null } | null
  }>).map((row) => ({
    id: row.principal_id,
    email: row.principals?.email ?? null,
    fullName: row.principals?.display_name ?? null,
    avatarUrl: row.principals?.avatar_url ?? null,
    role: row.role_key ?? null,
  }))
}

/** Fetch workspace general info (name + description). WorkspaceContext does not select description. */
export async function fetchWsGeneralInfo(workspaceId: string): Promise<WsGeneralInfo | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, description')
    .eq('id', workspaceId)
    .maybeSingle()
  if (error) throw new Error(`fetchWsGeneralInfo failed: ${error.message}`)
  if (!data) return null
  const row = data as { id: string; name: string; description: string | null }
  return { id: row.id, name: row.name, description: row.description }
}

/** Save workspace general info (name + description). */
export async function saveWsGeneralInfo(workspaceId: string, updates: { name?: string; description?: string }): Promise<void> {
  if (Object.keys(updates).length === 0) return
  const { error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
  if (error) throw new Error(`saveWsGeneralInfo failed: ${error.message}`)
}

/** Change a member's role in an org node. */
export async function changeOrgMemberRole(orgId: string, userId: string, newRole: string): Promise<void> {
  const { error } = await supabase
    .from('node_memberships')
    .update({ role_key: newRole })
    .eq('node_id', orgId)
    .eq('principal_id', userId)
    .eq('source_kind', 'direct_org')
  if (error) throw new Error(`changeOrgMemberRole failed: ${error.message}`)
}

/** Remove a member from an org. */
export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('node_memberships')
    .delete()
    .eq('node_id', orgId)
    .eq('principal_id', userId)
    .eq('source_kind', 'direct_org')
  if (error) throw new Error(`removeOrgMember failed: ${error.message}`)
}

/** Revoke a pending invitation by updating status to 'revoked' (aligns with legacy pattern). */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('workspace_invitations')
    .delete()
    .eq('id', invitationId)
  if (error) throw new Error(`revokeInvitation failed: ${error.message}`)
}

/** Invite a member to a workspace by email. */
export async function inviteMember(
  _orgId: string,
  email: string,
  role: string,
  workspaceId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from('workspace_invitations').insert({
    workspace_id: workspaceId,
    invited_email: email,
    role,
    status: 'pending',
  } as any)
  if (error) throw new Error(error.message)
}

// ─────────────────────────────────────────────────────────────────────────────
// Org People — default role + self-registration policy
// RPCs: get_org_member_role_defaults, set_org_default_member_role, set_org_allow_self_registration
// Table: organizations (default_member_role, allow_self_registration columns)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch org default member role + allow_self_registration via SECURITY DEFINER RPC. */
export async function fetchOrgDefaultMemberRole(orgId: string): Promise<OrgMemberRoleDefaults> {
  const { data, error } = await supabase.rpc(
    'get_org_member_role_defaults' as never,
    { p_org_id: orgId } as never,
  )
  if (error) throw new Error(`fetchOrgDefaultMemberRole failed: ${error.message}`)
  const result = data as { default_member_role: string; allow_self_registration: boolean } | null
  return {
    defaultMemberRole: result?.default_member_role ?? 'member',
    allowSelfRegistration: result?.allow_self_registration ?? false,
  }
}

/** Save the org default member role (owner/admin only via SECURITY DEFINER RPC). */
export async function saveOrgDefaultMemberRole(orgId: string, role: string): Promise<void> {
  const { error } = await supabase.rpc(
    'set_org_default_member_role' as never,
    { p_org_id: orgId, p_value: role } as never,
  )
  if (error) throw new Error(`saveOrgDefaultMemberRole failed: ${error.message}`)
}

/** Fetch org allow_self_registration flag (via get_org_member_role_defaults RPC). */
export async function fetchOrgSelfRegistration(orgId: string): Promise<boolean> {
  const defaults = await fetchOrgDefaultMemberRole(orgId)
  return defaults.allowSelfRegistration
}

/** Save the org allow_self_registration flag (owner/admin only via SECURITY DEFINER RPC). */
export async function saveOrgSelfRegistration(orgId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc(
    'set_org_allow_self_registration' as never,
    { p_org_id: orgId, p_value: enabled } as never,
  )
  if (error) throw new Error(`saveOrgSelfRegistration failed: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Org People — email verification policy
// Table: organizations.require_email_verification
// RPC: set_org_require_email_verification
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch whether the org requires email verification for new members. */
export async function fetchOrgRequireEmailVerification(orgId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .select('require_email_verification')
    .eq('id', orgId)
    .maybeSingle()
  if (error) throw new Error(`fetchOrgRequireEmailVerification failed: ${error.message}`)
  const row = data as { require_email_verification: boolean } | null
  return row?.require_email_verification ?? false
}

/** Save the org email verification policy (owner/admin only via SECURITY DEFINER RPC). */
export async function saveOrgRequireEmailVerification(orgId: string, value: boolean): Promise<void> {
  const { error } = await supabase.rpc(
    'set_org_require_email_verification' as never,
    { p_org_id: orgId, p_value: value } as never,
  )
  if (error) throw new Error(`saveOrgRequireEmailVerification failed: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Org People — add existing registered user by email
// RPC: resolve_profile_id_by_email
// Edge fn: send-workspace-access-email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up an existing registered user by email before the add-existing flow.
 * Returns null if no user with that email exists.
 */
export async function resolveProfileByEmail(email: string): Promise<ResolvedProfile | null> {
  const { data, error } = await supabase.rpc(
    'resolve_profile_id_by_email' as never,
    { _email: email } as never,
  )
  if (error) throw new Error(`resolveProfileByEmail failed: ${error.message}`)
  const rows = data as Array<{ id: string; email: string | null; full_name: string | null }> | null
  if (!rows || rows.length === 0) return null
  const row = rows[0]
  return { id: row.id, email: row.email, fullName: row.full_name }
}

/**
 * Add an existing registered user to a workspace by sending a workspace-access email.
 * Uses the send-workspace-access-email edge function.
 */
export async function addExistingUserToWorkspace(
  workspaceId: string,
  targetEmail: string,
  role: string,
  principalId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('send-workspace-access-email', {
    body: {
      workspace_id: workspaceId,
      target_email: targetEmail,
      role,
      principal_id: principalId,
    },
  })
  if (error) throw new Error(`addExistingUserToWorkspace failed: ${error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace self-registration (ws-level allow_self_join)
// NOTE: The workspaces table does not have an allow_self_registration column as
// of the current migrations — that flag lives on organizations (per
// 20260609100000_org_member_role_defaults.sql). The functions below are stubs
// that would target a future workspaces.allow_self_join column. Omitted until
// the column migration lands.
// ─────────────────────────────────────────────────────────────────────────────

// saveWsAllowSelfRegistration / fetchWsSelfRegistration are deferred:
// no workspaces.allow_self_registration column exists in the schema yet.

// ─────────────────────────────────────────────────────────────────────────────
// User Preferences
// Table: user_preferences (user_id, display_name, avatar_url, theme, language,
//   ai_model, response_style, personal_ai_instructions, notification_mode,
//   pinned_models, workspace_order, chat_selector_state)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all preferences for the signed-in user. Returns null if no row yet. */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select(
      'user_id, display_name, avatar_url, theme, language, ai_model, response_style, personal_ai_instructions, notification_mode',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`fetchUserPreferences failed: ${error.message}`)
  if (!data) return null
  const row = data as {
    user_id: string
    display_name: string | null
    avatar_url: string | null
    theme: string
    language: string
    ai_model: string
    response_style: string
    personal_ai_instructions: string
    notification_mode: string
  }
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    theme: row.theme,
    language: row.language,
    aiModel: row.ai_model,
    responseStyle: row.response_style,
    personalAiInstructions: row.personal_ai_instructions,
    notificationMode: row.notification_mode,
  }
}

/** Upsert the full preferences row for a user. */
export async function saveUserPreferences(
  userId: string,
  prefs: Partial<Omit<UserPreferences, 'userId'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { user_id: userId }
  if (prefs.displayName !== undefined) payload.display_name = prefs.displayName
  if (prefs.avatarUrl !== undefined) payload.avatar_url = prefs.avatarUrl
  if (prefs.theme !== undefined) payload.theme = prefs.theme
  if (prefs.language !== undefined) payload.language = prefs.language
  if (prefs.aiModel !== undefined) payload.ai_model = prefs.aiModel
  if (prefs.responseStyle !== undefined) payload.response_style = prefs.responseStyle
  if (prefs.personalAiInstructions !== undefined)
    payload.personal_ai_instructions = prefs.personalAiInstructions
  if (prefs.notificationMode !== undefined) payload.notification_mode = prefs.notificationMode

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from('user_preferences')
    .upsert(payload as any, { onConflict: 'user_id' })
  if (error) throw new Error(`saveUserPreferences failed: ${error.message}`)
}

/** Optimistic single-key update for user preferences (e.g. theme toggle). */
export async function updateUserPreference(
  userId: string,
  key: keyof Omit<UserPreferences, 'userId'>,
  value: string,
): Promise<void> {
  const columnMap: Record<string, string> = {
    displayName: 'display_name',
    avatarUrl: 'avatar_url',
    theme: 'theme',
    language: 'language',
    aiModel: 'ai_model',
    responseStyle: 'response_style',
    personalAiInstructions: 'personal_ai_instructions',
    notificationMode: 'notification_mode',
  }
  const col = columnMap[key]
  if (!col) throw new Error(`updateUserPreference: unknown key "${key}"`)

  const { error } = await supabase
    .from('user_preferences')
    // `as never`: dynamic-key payload trips supabase-js typed .upsert() inference.
    .upsert({ user_id: userId, [col]: value } as never, { onConflict: 'user_id' })
  if (error) throw new Error(`updateUserPreference failed: ${error.message}`)
}

/**
 * Upload an avatar file to the 'avatars' storage bucket and return the public URL.
 * The caller is responsible for writing the URL to user_preferences.avatar_url
 * (via saveUserPreferences or updateUserPreference).
 */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const filePath = `${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })
  if (uploadError) throw new Error(`uploadUserAvatar upload failed: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return urlData.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage
// View: org_api_usage_summary (org_id, user_id, day, model, provider, run_count,
//   total_input_tokens, total_output_tokens, total_cost, last_run_at)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch aggregated usage summary rows for an org (all members, all days). */
export async function fetchOrgUsageSummary(orgId: string): Promise<OrgUsageSummaryRow[]> {
  const { data, error } = await supabase
    .from('org_api_usage_summary')
    .select(
      'org_id, user_id, day, model, provider, run_count, total_input_tokens, total_output_tokens, total_cost, last_run_at',
    )
    .eq('org_id', orgId)
    .order('day', { ascending: false })
  if (error) throw new Error(`fetchOrgUsageSummary failed: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    org_id: string
    user_id: string
    day: string
    model: string | null
    provider: string | null
    run_count: number
    total_input_tokens: number | null
    total_output_tokens: number | null
    total_cost: number | null
    last_run_at: string
  }>).map((row) => ({
    orgId: row.org_id,
    userId: row.user_id,
    day: row.day,
    model: row.model,
    provider: row.provider,
    runCount: row.run_count,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCost: row.total_cost,
    lastRunAt: row.last_run_at,
  }))
}

/** Fetch usage summary aggregated per member (grouped by user_id) for an org. */
export async function fetchMemberUsage(orgId: string): Promise<OrgUsageSummaryRow[]> {
  // The view already has per-user rows — return them all for the org and let
  // the caller group/aggregate further if needed.
  return fetchOrgUsageSummary(orgId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing
// Tables: organization_billing_profile, commercial_billing_events
// Credit balance is owned by core/billing.ts::fetchWalletBalance (get_org_credit_balance RPC).
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the billing profile for an org. Returns null if no row yet. */
export async function fetchOrgBillingProfile(orgId: string): Promise<OrgBillingProfile | null> {
  const { data, error } = await supabase
    .from('organization_billing_profile')
    .select(
      'org_id, stripe_customer_id, billing_email, billing_contact_name, default_funding_policy, allow_personal_provider, managed_by_org_id, service_fee_rate',
    )
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw new Error(`fetchOrgBillingProfile failed: ${error.message}`)
  if (!data) return null
  const row = data as {
    org_id: string
    stripe_customer_id: string | null
    billing_email: string | null
    billing_contact_name: string | null
    default_funding_policy: string
    allow_personal_provider: boolean
    managed_by_org_id: string | null
    service_fee_rate: number
  }
  return {
    orgId: row.org_id,
    stripeCustomerId: row.stripe_customer_id,
    billingEmail: row.billing_email,
    billingContactName: row.billing_contact_name,
    defaultFundingPolicy: row.default_funding_policy,
    allowPersonalProvider: row.allow_personal_provider,
    managedByOrgId: row.managed_by_org_id,
    serviceFeeRate: row.service_fee_rate,
  }
}

/** Fetch recent billing events (purchase history) for an org. */
export async function fetchOrgBillingEvents(
  orgId: string,
  limit = 50,
): Promise<OrgBillingEvent[]> {
  const { data, error } = await supabase
    .from('commercial_billing_events')
    .select('id, org_id, event_type, credits, base_cost_usd, occurred_at')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`fetchOrgBillingEvents failed: ${error.message}`)

  return ((data ?? []) as unknown as Array<{
    id: string
    org_id: string
    event_type: string
    credits: number
    base_cost_usd: number
    occurred_at: string
  }>).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    eventType: row.event_type,
    credits: row.credits,
    baseCostUsd: row.base_cost_usd,
    occurredAt: row.occurred_at,
  }))
}

/** Fetch the timestamp of the last purchase event for an org. Returns null if none. */
export async function fetchLastPurchaseAt(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('commercial_billing_events')
    .select('occurred_at')
    .eq('org_id', orgId)
    .eq('event_type', 'purchase')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`fetchLastPurchaseAt failed: ${error.message}`)
  const row = data as { occurred_at: string } | null
  return row?.occurred_at ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge (system instructions)
// These operations target the instruction_components table via runner REST endpoints
// (/org/:orgId/system-instructions). Direct Supabase queries are deliberately NOT
// used here — the runner is the single writer per ADR 0040 / harness/channelsBCD.ts.
// Use core/runner.ts to call runner REST endpoints for knowledge operations.
// ─────────────────────────────────────────────────────────────────────────────

// fetchOrgKnowledgeDocs / saveOrgKnowledgeDoc / deleteOrgKnowledgeDoc:
// These are runner REST ops, not direct Supabase queries. Implement via
// core/runner.ts GET/PUT/DELETE /org/:orgId/system-instructions.

// ─────────────────────────────────────────────────────────────────────────────
// Org credentials
// Table: organization_credentials (organization_id PK, provider_credentials jsonb,
//   github_credentials jsonb, supabase_credentials jsonb)
// NOTE: The credentials blob is a JSONB column — there is no per-credential row model
// with a separate id. Individual credentials live inside provider_credentials/
// github_credentials/supabase_credentials blobs. The island Credentials section
// uses the runner REST endpoints (GET/POST /org/:orgId/credentials/health and
// POST /org/:orgId/auth-link) for actual credential management. The functions
// below cover the direct Supabase read path only.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgCredentialRow {
  organizationId: string
  providerCredentials: Record<string, unknown> | null
  githubCredentials: Record<string, unknown> | null
  supabaseCredentials: Record<string, unknown> | null
}

export interface OrgCredentialStatus {
  hasOpenAIApiKey?: boolean
  hasOpenAIOAuth?: boolean
  hasAnthropicApiKey?: boolean
  hasAnthropicOAuth?: boolean
  hasGeminiApiKey?: boolean
  hasXaiApiKey?: boolean
  hasOpenRouterApiKey?: boolean
  hasGitHubToken?: boolean
  hasSupabasePatToken?: boolean
  hasSupabaseConfigured?: boolean
}

/** Fetch the credential presence flags for an org via SECURITY DEFINER RPC. */
export async function fetchOrgCredentialStatus(orgId: string): Promise<OrgCredentialStatus> {
  const { data, error } = await supabase.rpc(
    'get_organization_credential_status' as never,
    { p_org_id: orgId } as never,
  )
  if (error) throw new Error(`fetchOrgCredentialStatus failed: ${error.message}`)
  return (data as OrgCredentialStatus | null) ?? {}
}

/**
 * Partial-update org credentials — only non-empty patch objects are written.
 * Provider keys live in provider_credentials blob, git in github_credentials, supabase in supabase_credentials.
 */
export async function updateOrgCredentialsPartial(
  orgId: string,
  providerPatch: Record<string, string>,
  githubPatch: Record<string, string>,
  supabasePatch: Record<string, string>,
): Promise<void> {
  const { error } = await supabase.rpc(
    'update_organization_credentials_partial' as never,
    {
      p_org_id: orgId,
      p_provider_patch: providerPatch,
      p_github_patch: githubPatch,
      p_supabase_patch: supabasePatch,
    } as never,
  )
  if (error) throw new Error(`updateOrgCredentialsPartial failed: ${error.message}`)
}

/** Fetch the raw credential blobs for an org. */
export async function fetchOrgCredentialBlobs(orgId: string): Promise<OrgCredentialRow | null> {
  const { data, error } = await supabase
    .from('organization_credentials')
    .select('organization_id, provider_credentials, github_credentials, supabase_credentials')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error) throw new Error(`fetchOrgCredentialBlobs failed: ${error.message}`)
  if (!data) return null
  const row = data as {
    organization_id: string
    provider_credentials: Record<string, unknown> | null
    github_credentials: Record<string, unknown> | null
    supabase_credentials: Record<string, unknown> | null
  }
  return {
    organizationId: row.organization_id,
    providerCredentials: row.provider_credentials,
    githubCredentials: row.github_credentials,
    supabaseCredentials: row.supabase_credentials,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace members — role change / remove
// (These parallel changeOrgMemberRole / removeOrgMember but for workspace nodes)
// ─────────────────────────────────────────────────────────────────────────────

/** Change a member's role in a workspace node. */
export async function changeWsMemberRole(wsId: string, userId: string, newRole: string): Promise<void> {
  const { error } = await supabase
    .from('node_memberships')
    .update({ role_key: newRole })
    .eq('node_id', wsId)
    .eq('principal_id', userId)
    .eq('source_kind', 'direct_workspace')
  if (error) throw new Error(`changeWsMemberRole failed: ${error.message}`)
}

/** Remove a member from a workspace. */
export async function removeWsMember(wsId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('node_memberships')
    .delete()
    .eq('node_id', wsId)
    .eq('principal_id', userId)
    .eq('source_kind', 'direct_workspace')
  if (error) throw new Error(`removeWsMember failed: ${error.message}`)
}
