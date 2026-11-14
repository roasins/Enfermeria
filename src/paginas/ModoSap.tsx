import { ArrowLeft, Check, ChevronLeft, ChevronRight, List, RectangleVertical } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Cargando, ErrorCaja, Vacio } from '../componentes/Basicos'
import { useAvisos } from '../contexto/Avisos'
import { useCatalogo } from '../contexto/Catalogo'
import { usePerfil } from '../contexto/Sesion'
import { fecha, mensajeError } from '../lib/formato'
import { lineasDePedido } from '../lib/lineas'
import { leerPedido } from '../lib/pedidos'
import { supabase } from '../lib/supabase'
import type { Pedido } from '../lib/tipos'

type Vista = 'una' | 'lista'
const CLAVE_VISTA = 'pedidos.vistaSap'

export function ModoSap() {
  const { id } = useParams()
  const perfil = usePerfil()
  const catalogo = useCatalogo()
  const { fallar } = useAvisos()
  const [pedido, setPedido] = useState<Pedido | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>(() => (localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'una'))
  const [indice, setIndice] = useState<number | null>(null)

  useEffect(() => {
    leerPedido(id!)
      .then(setPedido)
      .catch((e) => setError(mensajeError(e)))
  }, [id])

  const lineas = useMemo(() => (pedido ? lineasDePedido(pedido.pedido_items, catalogo.porId) : []), [pedido, catalogo.porId])

  // Al abrir, parte en la primera línea que falta.
  useEffect(() => {
    if (indice === null && lineas.length) {
      const primera = lineas.findIndex((l) => !l.cargado_sap)
      setIndice(primera === -1 ? 0 : primera)
    }
  }, [lineas, indice])

  if (error) return <ErrorCaja>{error}</ErrorCaja>
  if (pedido === undefined || catalogo.cargando) return <Cargando />
  if (pedido === null || pedido.estado !== 'cerrado' || pedido.usuario_id !== perfil.id) return <Vacio titulo="Pedido no encontrado" />

  const cargadas = lineas.filter((l) => l.cargado_sap).length
  const total = lineas.length
  const i = Math.min(indice ?? 0, total - 1)
  const actual = lineas[i]

  const marcar = async (insumoId: string, valor: boolean) => {
    const antes = pedido
    setPedido({ ...pedido, pedido_items: pedido.pedido_items.map((it) => (it.insumo_id === insumoId ? { ...it, cargado_sap: valor } : it)) })
    const { error } = await supabase.from('pedido_items').update({ cargado_sap: valor }).eq('pedido_id', pedido.id).eq('insumo_id', insumoId)
    if (error) {
      setPedido(antes)
      fallar(error)
    }
  }

  const marcarYSeguir = () => {
    void marcar(actual.insumo_id, true)
    // Avanza a la siguiente que falte (dando la vuelta si hace falta).
    for (let paso = 1; paso <= total; paso++) {
      const j = (i + paso) % total
      if (!lineas[j].cargado_sap && j !== i) return setIndice(j)
    }
  }

  const cambiarVista = (v: Vista) => {
    setVista(v)
    localStorage.setItem(CLAVE_VISTA, v)
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to={`/historial/${pedido.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700">
          <ArrowLeft className="size-4" /> Pedido del {fecha(pedido.cerrado_en!)}
        </Link>
        <div className="flex rounded-xl border border-slate-300 bg-white p-0.5" role="group" aria-label="Vista">
          {(
            [
              ['una', RectangleVertical, 'Una por pantalla'],
              ['lista', List, 'Lista'],
            ] as const
          ).map(([v, Icono, nombre]) => (
            <button key={v} type="button" onClick={() => cambiarVista(v)} aria-label={nombre} aria-pressed={vista === v} className={`grid h-9 w-11 place-items-center rounded-lg ${vista === v ? 'bg-teal-700 text-white' : 'text-slate-500'}`}>
              <Icono className="size-5" />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-lg font-bold">
            {cargadas} de {total} <span className="text-sm font-medium text-slate-500">ingresadas en SAP</span>
          </p>
          {cargadas === total && <span className="text-sm font-bold text-teal-700">¡Listo!</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cargadas}>
          <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${total ? (cargadas / total) * 100 : 0}%` }} />
        </div>
      </div>

      {vista === 'una' ? (
        <>
          <div className={`tarjeta p-5 text-center ${actual.cargado_sap ? 'border-teal-300 bg-teal-50' : ''}`}>
            <p className="text-sm font-semibold text-slate-500">
              Línea {i + 1} de {total} · Pos {actual.pos}
            </p>
            {actual.codigoPendiente ? (
              <p className="my-5 rounded-xl bg-amber-100 px-3 py-4 text-2xl font-extrabold tracking-wide text-amber-800">{actual.codigo}</p>
            ) : (
              <p className="codigo my-4 text-6xl font-extrabold tracking-wider text-slate-900 select-all">{actual.codigo}</p>
            )}
            <p className="text-lg leading-snug font-semibold text-slate-700">{actual.material}</p>
            <p className="mt-4 text-5xl font-extrabold tabular-nums">
              {actual.cantidad} <span className="text-2xl font-bold text-slate-500">{actual.unidad}</span>
            </p>
          </div>

          {actual.cargado_sap ? (
            <button type="button" className="btn-claro mt-4 h-16 w-full text-lg" onClick={() => marcar(actual.insumo_id, false)}>
              <Check className="size-6 text-teal-700" /> Ingresado · tocar para desmarcar
            </button>
          ) : (
            <button type="button" className="btn-primario mt-4 h-16 w-full text-lg" onClick={marcarYSeguir}>
              <Check className="size-6" /> Ingresado
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-claro flex-1" disabled={i === 0} onClick={() => setIndice(i - 1)}>
              <ChevronLeft className="size-5" /> Anterior
            </button>
            <button type="button" className="btn-claro flex-1" disabled={i >= total - 1} onClick={() => setIndice(i + 1)}>
              Siguiente <ChevronRight className="size-5" />
            </button>
          </div>
        </>
      ) : (
        <ul className="space-y-2">
          {lineas.map((l) => (
            <li key={l.insumo_id}>
              <label className={`tarjeta flex cursor-pointer items-center gap-3 p-3 ${l.cargado_sap ? 'border-teal-300 bg-teal-50' : ''}`}>
                <input type="checkbox" className="peer sr-only" checked={l.cargado_sap} onChange={(e) => marcar(l.insumo_id, e.target.checked)} />
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 ${l.cargado_sap ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                  <Check className="size-7" />
                </span>
                <span className="min-w-0 flex-1">
                  {l.codigoPendiente ? <span className="pendiente !text-sm">{l.codigo}</span> : <span className="codigo block text-3xl leading-tight font-extrabold tracking-wide">{l.codigo}</span>}
                  <span className={`block text-sm leading-snug ${l.cargado_sap ? 'text-slate-500' : 'text-slate-700'}`}>{l.material}</span>
                </span>
                <span className="shrink-0 text-right text-2xl font-extrabold whitespace-nowrap tabular-nums">
                  {l.cantidad}
                  <span className="block text-xs font-bold text-slate-500">{l.unidad}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
