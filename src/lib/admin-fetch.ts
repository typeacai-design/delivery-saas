'use client'

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: 'include' })
  if (response.status === 401 && typeof window !== 'undefined') {
    const from = window.location.pathname + window.location.search
    window.location.replace('/painel-admin/login?from=' + encodeURIComponent(from))
    throw new Error('Sessão administrativa expirada')
  }
  return response
}
