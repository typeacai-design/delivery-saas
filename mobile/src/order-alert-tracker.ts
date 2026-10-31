export type AlertOrder = { id: string; status: string; deleted_at?: string | null; data_criacao?: string }

// The first successful fetch is a silent baseline, never a new-order notification.
export class OrderAlertTracker {
  readonly startedAt: number
  constructor(startedAt = Date.now()) { this.startedAt = startedAt }
  readonly seen = new Set<string>()
  readonly pending = new Set<string>()
  initialized = false
  snapshot(orders: AlertOrder[]) {
    // The API is paginated. Absence from a snapshot must never silence a pending order.
    for (const order of orders) {
      if (this.initialized) this.receive(order, !order.data_criacao || new Date(order.data_criacao).getTime() >= this.startedAt)
      else this.seen.add(order.id)
    }
    this.initialized = true
  }
  receive(order: AlertOrder, isArrival = true) {
    if (order.deleted_at || order.status !== 'novo') this.pending.delete(order.id)
    else if (isArrival && !this.seen.has(order.id)) this.pending.add(order.id)
    this.seen.add(order.id)
  }
  remove(id: string) { this.pending.delete(id); this.seen.add(id) }
}
