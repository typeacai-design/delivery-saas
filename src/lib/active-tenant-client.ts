export async function activeTenantId(){
  const response=await fetch('/api/auth/session',{cache:'no-store'});const body=await response.json().catch(()=>null)
  return response.ok&&body?.tenant?.id?String(body.tenant.id):null
}
