import { Minus, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Insumo } from '../lib/tipos'
import { Codigo } from './Basicos'
import { Hoja } from './Hoja'

const RAPIDAS = [1, 2, 5, 10, 20, 50, 100]

/** Pide la cantidad de un insumo (para agregarlo o cambiarlo). */
export function DialogoCantidad(props: {
  insumo: Insumo
  /** Cantidad actual en el pedido (0 si no está). */
  actual: number
  /** Cantidad habitual, si se conoce. */
  sugerida?: number
  onGuardar: (cantidad: number) => void
  onQuitar?: () => void
  onCerrar: () => void
}) {
  const { insumo, actual, sugerida, onGuardar, onQuitar, onCerrar } = props
  const [texto, setTexto] = useState(String(actual || sugerida || 1))
  const cantidad = /^\d+$/.test(texto) ? Number(texto) : 0
  const valida = cantidad > 0 && cantidad <= 99999
  const sumar = (n: number) => setTexto(String(Math.max(1, (cantidad || 0) + n)))

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valida) onGuardar(cantidad)
  }

  return (
    <Hoja titulo={insumo.nombre} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <p className="-mt-3 mb-4 text-sm">
          <Codigo codigo={insumo.codigo} /> <span className="text-slate-400">·</span> <span className="text-slate-600">Unidad: {insumo.unidad}</span>
        </p>
        <label className="etiqueta" htmlFor="cantidad">
          Cantidad
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-claro size-14 shrink-0 !px-0" onClick={() => sumar(-1)} aria-label="Restar uno">
            <Minus className="size-6" />
          </button>
          <div className="relative flex-1">
            <input
              id="cantidad"
              className="campo h-14 pr-14 text-center !text-2xl font-bold tabular-nums"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              autoComplete="off"
              value={texto}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500">{insumo.unidad}</span>
          </div>
          <button type="button" className="btn-claro size-14 shrink-0 !px-0" onClick={() => sumar(1)} aria-label="Sumar uno">
            <Plus className="size-6" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {RAPIDAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTexto(String(n))}
              className={`min-h-10 min-w-12 rounded-lg border px-3 text-sm font-semibold ${cantidad === n ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              {n}
            </button>
          ))}
        </div>
        {sugerida ? <p className="mt-3 text-sm text-slate-500">Sueles pedir {sugerida} {insumo.unidad}.</p> : null}
        <div className="mt-5 flex gap-2">
          {actual > 0 && onQuitar && (
            <button type="button" className="btn-peligro" onClick={onQuitar}>
              <Trash2 className="size-5" /> Quitar
            </button>
          )}
          <button type="submit" className="btn-primario flex-1" disabled={!valida}>
            {actual > 0 ? 'Guardar cantidad' : 'Agregar al pedido'}
          </button>
        </div>
      </form>
    </Hoja>
  )
}
