import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { RemoteCache } from './remote-cache';
const Context = createContext<RemoteCache | null>(null);
export function RemoteProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(() => new RemoteCache());
  useEffect(() => () => cache.clear(), [cache]);
  return createElement(Context.Provider, { value: cache }, children);
}
export function useRemoteCache() { const cache = useContext(Context); if (!cache) throw new Error('Cache fora da sessão.'); return cache; }
type Options = { key?: string; enabled?: boolean; ttl?: number };
export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>, options: Options = {}) {
  const shared = useContext(Context), [local] = useState(() => new RemoteCache()),
    cache = options.key && shared ? shared : local,
    // Unkeyed legacy callers get a private entry per loader, preserving retry data
    // without ever showing a previous entity/filter under a new title.
    identity = useRef({ load, n: 0 });
  if (identity.current.load !== load) identity.current = { load, n: identity.current.n + 1 };
  const key = options.key || `local:${identity.current.n}`, enabled = options.enabled !== false,
    snapshot = useSyncExternalStore(useCallback(fn => cache.subscribe(key, fn), [cache, key]), useCallback(() => cache.snapshot<T>(key), [cache, key]));
  useEffect(() => { if (enabled) void cache.load(key, load, false, options.ttl); }, [cache, key, load, enabled, options.ttl, snapshot.revision]);
  useEffect(() => () => local.clear(), [local]);
  const retry = useCallback(() => { cache.invalidate(key); }, [cache, key]);
  const update = useCallback((fn: (data: T) => T) => cache.patch(key, fn), [cache, key]);
  return { ...snapshot, loading: snapshot.loading || (enabled && snapshot.data === null && !snapshot.error), retry, update };
}
