import { supabase } from './supabase';
import { checkStore } from './catalog-api';
import { readAll } from './scoped-data';
export async function couriers(storeId: string, signal: AbortSignal) {
  await checkStore(storeId);
  return readAll(() => supabase.from('motoboys').select('id,nome,telefone,ativo').eq('tenant_id',storeId).order('nome').order('id'), signal);
}
export async function assignCourier(storeId: string, orderId: string, courierId: string | null) {
  await checkStore(storeId);
  if (courierId) {
    const m = await supabase.from('motoboys').select('id').eq('tenant_id',storeId).eq('id',courierId).eq('ativo',true).maybeSingle();
    if (m.error || !m.data) throw new Error('Entregador indisponível nesta loja.');
  }
  const r = await supabase.from('pedidos').update({motoboy_id:courierId}).eq('tenant_id',storeId).eq('id',orderId).is('deleted_at',null).select('id,motoboy_id,motoboy_comissao').single();
  if (r.error) throw new Error('Não foi possível salvar o entregador.');
  return r.data;
}
