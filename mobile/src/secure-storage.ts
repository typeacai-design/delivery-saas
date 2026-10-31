type Driver = { getItemAsync(key: string): Promise<string | null>; setItemAsync(key: string, value: string): Promise<void>; deleteItemAsync(key: string): Promise<void> }
type Head = { version: string; count: number }
// Every session fragment stays encrypted in SecureStore. Never spill tokens into AsyncStorage.
export function createSessionStorage(driver: Driver, generation: () => string) {
  const queues = new Map<string, Promise<unknown>>()
  const parse = (value: string | null): Head | null => {
    if (!value) return null
    const head = JSON.parse(value) as Head
    if (!/^[a-zA-Z0-9_-]+$/.test(head.version) || !Number.isInteger(head.count) || head.count < 0 || head.count > 200) throw new Error('Sessão local inválida. Entre novamente.')
    return head
  }
  const part = (key: string, h: Head, n: number) => `${key}.${h.version}.${n}`
  function serial<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) return Promise.reject(new Error('Chave de sessão inválida.'))
    const next = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(operation)
    queues.set(key, next)
    void next.finally(() => { if (queues.get(key) === next) queues.delete(key) }).catch(() => undefined)
    return next
  }
  return {
    getItem: (key: string) => serial(key, async () => {
      const h = parse(await driver.getItemAsync(key)); if (!h) return null
      const pieces = await Promise.all(Array.from({ length: h.count }, (_, n) => driver.getItemAsync(part(key, h, n))))
      if (pieces.some(x => x === null)) throw new Error('Sessão incompleta. Entre novamente.')
      return pieces.join('')
    }),
    setItem: (key: string, value: string) => serial(key, async () => {
      const old = parse(await driver.getItemAsync(key)), h = { version: generation(), count: Math.ceil(value.length / 400) }
      if (h.count > 200) throw new Error('A sessão excedeu o tamanho permitido.')
      const written: string[] = []
      try {
        for (let i = 0; i < h.count; i++) { const k = part(key, h, i); await driver.setItemAsync(k, value.slice(i * 400, (i + 1) * 400)); written.push(k) }
        await driver.setItemAsync(key, JSON.stringify(h)) // Commit pointer only after all fragments are durable.
      } catch (error) { await Promise.allSettled(written.map(k => driver.deleteItemAsync(k))); throw error }
      if (old) await Promise.allSettled(Array.from({ length: old.count }, (_, n) => driver.deleteItemAsync(part(key, old, n))))
    }),
    removeItem: (key: string) => serial(key, async () => {
      const h = parse(await driver.getItemAsync(key)); await driver.deleteItemAsync(key)
      if (h) await Promise.allSettled(Array.from({ length: h.count }, (_, n) => driver.deleteItemAsync(part(key, h, n))))
    }),
  }
}
