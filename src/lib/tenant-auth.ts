import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export type TenantRole = 'owner' | 'manager' | 'attendant' | 'kitchen' | 'motoboy' | 'delivery'
export const ALL_TENANT_ROLES: TenantRole[] = ['owner', 'manager', 'attendant', 'kitchen', 'motoboy', 'delivery']
export const MANAGEMENT_ROLES: TenantRole[] = ['owner', 'manager']
export const SALES_ROLES: TenantRole[] = ['owner', 'manager', 'attendant']
interface TenantMembership { tenant_id: string; role: TenantRole; ativo: boolean }

export async function authenticatedTenant(allowedRoles: TenantRole[] = ['owner'], options: { allowPending?: boolean } = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, tenantId: null, role: null, tenantStatus: null, forbidden: false }
  const selected=(await cookies()).get('wd_active_tenant')?.value
  const { data: members } = await supabase.from('usuarios_loja').select('tenant_id,role,ativo').eq('user_id', user.id).eq('ativo', true)
  const ordered=([...(members||[])] as TenantMembership[]).sort((a,b)=>((a.role==='owner'?0:1)-(b.role==='owner'?0:1))||a.tenant_id.localeCompare(b.tenant_id))
  const member=(selected&&ordered.find((m)=>m.tenant_id===selected))||ordered[0]
  const role = member?.role as TenantRole | undefined
  const roleTenantId = role && allowedRoles.includes(role) ? member?.tenant_id || null : null
  const { data: tenant } = roleTenantId ? await supabase.from('tenants').select('status').eq('id', roleTenantId).maybeSingle() : { data: null }
  const tenantStatus = tenant?.status || null
  const statusAllowed = tenantStatus === 'active' || (options.allowPending === true && tenantStatus === 'pending_approval')
  const tenantId = statusAllowed ? roleTenantId : null
  return { supabase, user, tenantId, role: role || null, tenantStatus, forbidden: Boolean(member && !tenantId) }
}

export function tenantAuthStatus(auth: Awaited<ReturnType<typeof authenticatedTenant>>) {
  if (!auth.user) return 401
  if (!auth.tenantId) return 403
  return null
}

