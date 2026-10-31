export type GoogleMembership = { tenant_id: string; role: string; ativo: boolean }
export function hasGoogleIdentity(user: { identities?: { provider?: string }[]; email?: string; email_confirmed_at?: string } | null) {
  return Boolean(user?.email && user.email_confirmed_at && user.identities?.some(identity => identity.provider === 'google'))
}
export function googleDestination(memberships: GoogleMembership[], status: string | null): string {
  if (!memberships.length) return '/registro?google=1'
  const member = memberships[0]
  if (!member.ativo || !['active', 'pending_approval'].includes(status || '')) return '/login?oauth_error=blocked'
  if (status === 'pending_approval') return '/aguardando-aprovacao'
  if (member.role === 'owner' || member.role === 'manager') return '/dashboard'
  const destinations: Record<string, string> = { attendant: '/acesso/atendimento', kitchen: '/acesso/cozinha', motoboy: '/acesso/motoboy' }
  return destinations[member.role] || '/login?oauth_error=blocked'
}
export function normalizeReferral(value: string | null) {
  return (value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
}

