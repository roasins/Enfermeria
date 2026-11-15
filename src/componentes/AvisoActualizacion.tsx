import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { actualizarApp, useActualizacion } from '../lib/version'

/** Franja que aparece cuando hay una versión nueva publicada. */
export function AvisoActualizacion() {
  const { hayNueva } = useActualizacion()
  const [actualizando, setActualizando] = useState(false)
  if (!hayNueva) return null
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-amber-950" role="status">
      <p className="text-sm font-semibold">Hay una versión nueva de la app.</p>
      <button
        type="button"
        disabled={actualizando}
        onClick={() => {
          setActualizando(true)
          void actualizarApp()
        }}
        className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-amber-900 px-3 text-sm font-bold text-white disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${actualizando ? 'animate-spin' : ''}`} /> {actualizando ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  )
}
