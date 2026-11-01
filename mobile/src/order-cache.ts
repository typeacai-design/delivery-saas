import type { Order } from './domain';
import type { RemoteCache } from './remote-cache';
export type OrderPage = { orders: Order[]; count: number; filter: { from: string; until: string; stage: string; page: number } };
function matches(order: Order, filter: OrderPage['filter']) {
  const time = new Date(order.data_criacao).getTime();
  return (filter.stage === 'todos' || order.status === filter.stage) && (!filter.from || time >= new Date(filter.from).getTime()) && (!filter.until || time < new Date(filter.until).getTime());
}
export function confirmOrder(cache: RemoteCache, storeId: string, order: Order, previous?: Order) {
  cache.generation(`order-event:${storeId}:${order.id}`);
  cache.invalidate(`order-event:${storeId}:${order.id}`);
  const keys = cache.keys(`orders:${storeId}:`);
  const old = previous || keys.flatMap(k => cache.snapshot<OrderPage>(k).data?.orders || []).find(o => o.id === order.id);
  for (const key of keys) {
    const data = cache.snapshot<OrderPage>(key).data; if (!data) continue;
    const had = data.orders.some(o => o.id === order.id), now = matches(order, data.filter), before = old ? matches(old, data.filter) : undefined;
    if (!had && before === undefined) { cache.invalidate(key); continue; }
    cache.patch<OrderPage>(key, page => {
      const rows = page.orders.filter(o => o.id !== order.id);
      if (now && (had || page.filter.page === 0)) rows.push(order);
      rows.sort((a,b) => b.data_criacao.localeCompare(a.data_criacao) || b.id.localeCompare(a.id));
      return { ...page, orders: rows.slice(0,25), count: Math.max(0, page.count + Number(now) - Number(before ?? had)) };
    });
    // Refill a paginated gap in the background; a confirmed action never waits for it.
    if ((had && !now && data.count > 25) || data.filter.page > 0) cache.invalidate(key);
  }
  cache.invalidate(`home:${storeId}`);
  cache.invalidate(`finance:${storeId}:`);
}

export function confirmMutation(cache: RemoteCache, storeId: string, previous: Order, patch: Partial<Order>) {
  const current = cache.keys(`orders:${storeId}:`).flatMap(k => cache.snapshot<OrderPage>(k).data?.orders || []).find(o => o.id === previous.id) || previous;
  confirmOrder(cache, storeId, { ...current, ...patch }, current);
}
