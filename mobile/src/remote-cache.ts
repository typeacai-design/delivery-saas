/** Session-local memory only. A provider owns this cache and destroys it on logout. */
export type Snapshot<T = any> = { data: T | null; error: string; loading: boolean; revision: number };
type Entry = { snapshot: Snapshot; updated: number; sequence: number; controller?: AbortController; pending?: Promise<void>; listeners: Set<() => void> };
export class RemoteCache {
  private entries = new Map<string, Entry>();
  private entry(key: string): Entry {
    let e = this.entries.get(key);
    if (!e) { e = { snapshot: { data: null, error: '', loading: false, revision: 0 }, updated: 0, sequence: 0, listeners: new Set() }; this.entries.set(key, e); }
    return e;
  }
  snapshot<T>(key: string) { return this.entry(key).snapshot as Snapshot<T>; }
  subscribe(key: string, listener: () => void) { const e = this.entry(key); e.listeners.add(listener); return () => { e.listeners.delete(listener); }; }
  private emit(e: Entry, patch: Partial<Snapshot>) { e.snapshot = { ...e.snapshot, ...patch }; for (const fn of e.listeners) fn(); }
  async load<T>(key: string, load: (signal: AbortSignal) => Promise<T>, force = false, ttl = 30000) {
    const e = this.entry(key);
    if (e.pending) return e.pending;
    if (!force && e.snapshot.data !== null && Date.now() - e.updated < ttl) return;
    const sequence = ++e.sequence, controller = new AbortController(); e.controller = controller;
    this.emit(e, { loading: true, error: '' });
    const pending = Promise.resolve().then(() => load(controller.signal)).then(data => {
      if (sequence !== e.sequence || controller.signal.aborted) return;
      e.updated = Date.now(); this.emit(e, { data, loading: false, error: '' });
    }).catch(error => {
      if (sequence !== e.sequence || controller.signal.aborted) return;
      this.emit(e, { loading: false, error: error instanceof Error ? error.message : 'Não foi possível atualizar.' });
    }).finally(() => { if (sequence === e.sequence) { e.pending = undefined; e.controller = undefined; } });
    e.pending = pending; return pending;
  }
  invalidate(prefix: string) {
    for (const [key, e] of this.entries) if (key.startsWith(prefix)) {
      ++e.sequence; e.controller?.abort(); e.pending = undefined; e.updated = 0;
      this.emit(e, { loading: false, revision: e.snapshot.revision + 1 });
    }
  }
  patch<T>(key: string, update: (data: T) => T) {
    const e = this.entry(key); if (e.snapshot.data === null) return;
    ++e.sequence; e.controller?.abort(); e.pending = undefined;
    this.emit(e, { data: update(e.snapshot.data), loading: false, error: '' });
  }
  generation(key: string) { return this.entry(key).sequence; }
  keys(prefix: string) { return [...this.entries.keys()].filter(k => k.startsWith(prefix)); }
  clear() { for (const e of this.entries.values()) { ++e.sequence; e.controller?.abort(); } this.entries.clear(); }
}
