import { useEffect, useMemo, useState } from 'react'
import { Cargando, Codigo, ErrorCaja, Titulo, Vacio } from '../componentes/Basicos'
import { useCatalogo } from '../contexto/Catalogo'
import { useSesion } from '../contexto/Sesion'
import { calcularEstadisticas, inicioPeriodo, PERIODOS, type Periodo } from '../lib/estadisticas'
import { mensajeError } from '../lib/formato'
import { leerCerrados } from '../lib/pedidos'
import type { Pedido } from '../lib/tipos'
import { usePerfiles } from '../lib/usuarias'

export function Estadisticas() {
  const { perfil, esAdmin } = useSesion()
  const catalogo = useCatalogo()
  const perfiles = usePerfiles(esAdmin)
  const [periodo, setPeriodo] = useState<Periodo>('6m')
  const [de, setDe] = useState<string>(esAdmin ? 'todas' : perfil!.id)
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPedidos(null)
    leerCerrados({ usuarioId: de === 'todas' ? null : de, desde: inicioPeriodo(periodo), limite: 2000 })
      .then((p) => {
        setPedidos(p)
        setError(null)
      })
      .catch((e) => setError(mensajeError(e)))
  }, [de, periodo])

  const filas = useMemo(() => calcularEstadisticas((pedidos ?? []).map((p) => ({ items: p.pedido_items }))), [pedidos])
  const totalPedidos = pedidos?.length ?? 0

  return (
    <>
      <Titulo>Estadísticas</Titulo>
      <div className={`mb-4 grid gap-2 ${esAdmin ? 'sm:grid-cols-2' : ''}`}>
        <select className="campo" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} aria-label="Período">
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.nombre}
            </option>
          ))}
        </select>
        {esAdmin && (
          <select className="campo" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Enfermera">
            <option value="todas">Todas las enfermeras</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === perfil!.id ? `${p.nombre} (yo)` : p.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <ErrorCaja>{error}</ErrorCaja>
      ) : pedidos === null || catalogo.cargando ? (
        <Cargando />
      ) : filas.length === 0 ? (
        <Vacio titulo="Sin pedidos cerrados en este período">Prueba con un período más largo.</Vacio>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">
            Insumos más pedidos en <strong className="text-slate-900">{totalPedidos} {totalPedidos === 1 ? 'pedido cerrado' : 'pedidos cerrados'}</strong> · {filas.length} insumos distintos
          </p>
          <ol className="tarjeta divide-y divide-slate-100">
            {filas.map((f, n) => {
              const insumo = catalogo.porId.get(f.insumo_id)
              const unidad = insumo?.unidad ?? ''
              return (
                <li key={f.insumo_id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="w-6 shrink-0 pt-0.5 text-right text-sm font-bold text-slate-400 tabular-nums">{n + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug font-semibold">
                        {insumo?.nombre ?? '(insumo desconocido)'}
                        {insumo && !insumo.activo && <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-600">desactivado</span>}
                      </p>
                      <p className="text-sm">
                        <Codigo codigo={insumo?.codigo ?? null} />
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-teal-600" style={{ width: `${(f.pedidos / totalPedidos) * 100}%` }} />
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600">
                        En <strong className="text-slate-900">{f.pedidos}</strong> de {totalPedidos} {totalPedidos === 1 ? 'pedido' : 'pedidos'} · promedio{' '}
                        <strong className="text-slate-900">
                          {f.promedio.toLocaleString('es-CL')} {unidad}
                        </strong>{' '}
                        · total {f.total.toLocaleString('es-CL')} {unidad}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </>
  )
}
