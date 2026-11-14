import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Cargando, ErrorCaja, Titulo, Vacio } from '../componentes/Basicos'
import { useSesion } from '../contexto/Sesion'
import { fecha, hora, mensajeError } from '../lib/formato'
import { leerCerrados } from '../lib/pedidos'
import type { Pedido } from '../lib/tipos'
import { usePerfiles } from '../lib/usuarias'

export function Historial() {
  const { perfil, esAdmin } = useSesion()
  const perfiles = usePerfiles(esAdmin)
  const [de, setDe] = useState<string>(perfil!.id) // id de usuaria, o 'todas'
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPedidos(null)
    leerCerrados({ usuarioId: de === 'todas' ? null : de })
      .then((p) => {
        setPedidos(p)
        setError(null)
      })
      .catch((e) => setError(mensajeError(e)))
  }, [de])

  const nombreDe = (id: string) => perfiles.find((p) => p.id === id)?.nombre ?? '—'

  return (
    <>
      <Titulo>Historial</Titulo>
      {esAdmin && (
        <select className="campo mb-4" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Ver pedidos de">
          <option value={perfil!.id}>Mis pedidos</option>
          <option value="todas">Pedidos de todas</option>
          {perfiles
            .filter((p) => p.id !== perfil!.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.activo ? '' : ' (desactivada)'}
              </option>
            ))}
        </select>
      )}
      {error ? (
        <ErrorCaja>{error}</ErrorCaja>
      ) : pedidos === null ? (
        <Cargando />
      ) : pedidos.length === 0 ? (
        <Vacio titulo="Todavía no hay pedidos cerrados">Aquí quedarán los pedidos con su Excel y su avance de carga a SAP.</Vacio>
      ) : (
        <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
          {pedidos.map((p) => {
            const total = p.pedido_items.length
            const cargadas = p.pedido_items.filter((i) => i.cargado_sap).length
            return (
              <li key={p.id}>
                <Link to={`/historial/${p.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {fecha(p.cerrado_en!)} <span className="text-sm font-normal text-slate-500">{hora(p.cerrado_en!)}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {total} {total === 1 ? 'línea' : 'líneas'}
                      {de !== perfil!.id && p.usuario_id !== perfil!.id ? ` · ${nombreDe(p.usuario_id)}` : ''}
                      {p.numero_sap ? ` · SAP ${p.numero_sap}` : ''}
                    </p>
                    {p.nota && <p className="truncate text-sm text-slate-500">{p.nota}</p>}
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${cargadas === total ? 'bg-teal-50 text-teal-800' : cargadas > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    {cargadas === total ? 'En SAP' : `SAP ${cargadas}/${total}`}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
