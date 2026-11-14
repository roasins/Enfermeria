import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { mensajeError } from '../lib/formato'

interface Avisos {
  avisar: (texto: string) => void
  /** Muestra un error (acepta el error tal cual llega). */
  fallar: (e: unknown) => void
}
const Ctx = createContext<Avisos | null>(null)

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ texto: string; error: boolean; n: number } | null>(null)
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined)

  const mostrar = useCallback((texto: string, error: boolean) => {
    clearTimeout(reloj.current)
    setAviso({ texto, error, n: Date.now() })
    reloj.current = setTimeout(() => setAviso(null), error ? 6000 : 2200)
  }, [])
  const avisar = useCallback((t: string) => mostrar(t, false), [mostrar])
  const fallar = useCallback((e: unknown) => mostrar(mensajeError(e), true), [mostrar])

  return (
    <Ctx.Provider value={{ avisar, fallar }}>
      {children}
      {aviso && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4" role="status" aria-live="polite">
          <div
            key={aviso.n}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${aviso.error ? 'bg-red-700' : 'bg-slate-900'}`}
            onClick={() => setAviso(null)}
          >
            {aviso.texto}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useAvisos(): Avisos {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAvisos fuera de AvisosProvider')
  return v
}
