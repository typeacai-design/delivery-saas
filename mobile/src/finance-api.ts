import { supabase } from './supabase';
export type FinanceTotals = { received: number; receivable: number; balance: number };
export type FinancePage = { rows: Record<string, any>[]; hasMore: boolean };
export async function financeRead<T>(storeId: string, view: string, signal: AbortSignal, offset = 0, range?: { from: string; to: string }) {
  const r = await supabase.rpc('mobile_financeiro', { p_tenant_id: storeId, p_view: view, p_offset: offset, p_limit: 50, p_from: range?.from || null, p_to: range?.to || null }).abortSignal(signal);
  if (r.error) throw new Error('Não foi possível carregar o financeiro. Tente novamente.');
  return r.data as T;
}
