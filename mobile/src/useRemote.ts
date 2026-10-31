import {useEffect,useState} from 'react'
export function useRemote<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: true }), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); setResult(previous => ({ data: previous.data, error: '', loading: true }))
    void load(controller.signal).then(data => { if (!controller.signal.aborted) setResult({ data, error: '', loading: false }) }).catch(err => {
      if (!controller.signal.aborted) setResult({ data: null, error: err instanceof Error ? err.message : 'Não foi possível atualizar.', loading: false })
    })
    return () => controller.abort()
  }, [load, attempt])
  return { ...result, retry: () => setAttempt(x => x + 1) }
}
