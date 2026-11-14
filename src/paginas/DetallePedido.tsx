import { ArrowLeft, Check, Copy, Download, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Cargando, Codigo, ErrorCaja, Vacio } from '../componentes/Basicos'
import { Hoja } from '../componentes/Hoja'
import { useAvisos } from '../contexto/Avisos'
import { useBorrador } from '../contexto/Borrador'
import { useCatalogo } from '../contexto/Catalogo'
import { useSesion } from '../contexto/Sesion'
import { descargarExcel } from '../lib/excel'
import { fechaLarga, hora, mensajeError } from '../lib/formato'
import { lineasDePedido } from '../lib/lineas'
import { leerPedido } from '../lib/pedidos'
import { supabase } from '../lib/supabase'
import type { Pedido } from '../lib/tipos'
import { usePerfiles } from '../lib/usuarias'

export function DetallePedido() {
  const { id } = useParams()
  const { perfil, esAdmin } = useSesion()
  const catalogo = useCatalogo()
  const borrador = useBorrador()
  const perfiles = usePerfiles(esAdmin)
  const { avisar, fallar } = useAvisos()
  const navegar = useNavigate()
  const recienCerrado = (useLocation().state as { recienCerrado?: boolean } | null)?.recienCerrado === true

  const [pedido, setPedido] = useState<Pedido | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [numeroSap, setNumeroSap] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmarDuplicar, setConfirmarDuplicar] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    leerPedido(id!)
      .then((p) => {
        setPedido(p)
        setNumeroSap(p?.numero_sap ?? '')
      })
      .catch((e) => setError(mensajeError(e)))
  }, [id])

  const lineas = useMemo(() => (pedido ? lineasDePedido(pedido.pedido_items, catalogo.porId) : []), [pedido, catalogo.porId])

  if (error) return <ErrorCaja>{error}</ErrorCaja>
  if (pedido === undefined || catalogo.cargando) return <Cargando />
  if (pedido === null || pedido.estado !== 'cerrado') return <Vacio titulo="Pedido no encontrado" />

  const esMio = pedido.usuario_id === perfil!.id
  const solicitante = esMio ? perfil!.nombre : (perfiles.find((p) => p.id === pedido.usuario_id)?.nombre ?? '')
  const cargadas = lineas.filter((l) => l.cargado_sap).length

  const excel = () =>
    descargarExcel({ lineas, solicitante, fecha: pedido.cerrado_en!, numeroSap: pedido.numero_sap, nota: pedido.nota }).catch(fallar)

  const guardarSap = async () => {
    setGuardando(true)
    const valor = numeroSap.trim() || null
    const { error } = await supabase.from('pedidos').update({ numero_sap: valor }).eq('id', pedido.id)
    setGuardando(false)
    if (error) return fallar(error)
    setPedido({ ...pedido, numero_sap: valor })
    avisar('Número SAP guardado')
  }

  const duplicar = async (reemplazar: boolean) => {
    const lista = pedido.pedido_items.filter((i) => catalogo.porId.get(i.insumo_id)?.activo).map((i) => ({ insumo_id: i.insumo_id, cantidad: i.cantidad }))
    const omitidos = pedido.pedido_items.length - lista.length
    setOcupado(true)
    try {
      await borrador.ponerVarios(lista, reemplazar)
      avisar(omitidos ? `Duplicado. ${omitidos} insumo(s) desactivado(s) no se copiaron.` : 'Pedido duplicado como borrador')
      navegar('/pedido')
    } catch (e) {
      fallar(e)
      setOcupado(false)
    }
  }

  return (
    <>
      <Link to="/historial" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700">
        <ArrowLeft className="size-4" /> Historial
      </Link>

      {recienCerrado && (
        <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <p className="flex items-center gap-2 font-bold text-teal-900">
            <Check className="size-5" /> Pedido cerrado
          </p>
          <p className="mt-1 text-sm text-teal-900/80">El Excel se descarga solo; si no apareció, usa el botón de abajo. Cuando estés frente a SAP, abre el modo carga.</p>
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight first-letter:uppercase">{fechaLarga(pedido.cerrado_en!)}</h1>
      <p className="mt-1 text-slate-600">
        {hora(pedido.cerrado_en!)} · {solicitante || 'Otra usuaria'} · {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
      </p>
      {pedido.nota && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{pedido.nota}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="btn-claro" onClick={excel}>
          <Download className="size-5" /> Excel
        </button>
        <button type="button" className="btn-claro" onClick={() => (borrador.items.length ? setConfirmarDuplicar(true) : duplicar(false))} disabled={ocupado}>
          <Copy className="size-5" /> Duplicar
        </button>
        {esMio && (
          <Link to={`/sap/${pedido.id}`} className="btn-primario col-span-2">
            <ListChecks className="size-5" /> Modo carga a SAP · {cargadas} de {lineas.length}
          </Link>
        )}
      </div>

      {esMio ? (
        <div className="mt-5">
          <label className="etiqueta" htmlFor="sap">
            N° de pedido SAP
          </label>
          <div className="flex gap-2">
            <input id="sap" className="campo codigo" inputMode="numeric" autoComplete="off" maxLength={30} placeholder="Ej.: 4500012345" value={numeroSap} onChange={(e) => setNumeroSap(e.target.value)} />
            <button type="button" className="btn-claro" onClick={guardarSap} disabled={guardando || (numeroSap.trim() || null) === pedido.numero_sap}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        pedido.numero_sap && (
          <p className="mt-4 text-sm text-slate-600">
            N° de pedido SAP: <span className="codigo font-semibold text-slate-900">{pedido.numero_sap}</span>
          </p>
        )
      )}

      <h2 className="mt-6 mb-2 text-lg font-bold">Detalle</h2>
      <ul className="tarjeta divide-y divide-slate-100">
        {lineas.map((l) => (
          <li key={l.insumo_id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-8 shrink-0 text-right text-sm text-slate-400 tabular-nums">{l.pos}</span>
            <div className="min-w-0 flex-1">
              <p className="leading-snug font-medium">{l.material}</p>
              <p className="text-sm">
                <Codigo codigo={l.codigo} />
              </p>
            </div>
            <span className="shrink-0 text-right font-bold whitespace-nowrap tabular-nums">
              {l.cantidad} <span className="text-sm font-semibold text-slate-500">{l.unidad}</span>
            </span>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${l.cargado_sap ? 'bg-teal-700 text-white' : 'border border-slate-300'}`} title={l.cargado_sap ? 'Ingresado en SAP' : 'Falta ingresar en SAP'}>
              {l.cargado_sap && <Check className="size-4" />}
            </span>
          </li>
        ))}
      </ul>

      {confirmarDuplicar && (
        <Hoja titulo="Ya tienes un pedido en curso" onCerrar={() => !ocupado && setConfirmarDuplicar(false)}>
          <p className="text-slate-600">
            Tu pedido en curso tiene {borrador.items.length} {borrador.items.length === 1 ? 'línea' : 'líneas'}. ¿Qué hacemos con ellas?
          </p>
          <div className="mt-5 grid gap-2">
            <button type="button" className="btn-primario" onClick={() => duplicar(true)} disabled={ocupado}>
              Reemplazar por este pedido
            </button>
            <button type="button" className="btn-claro" onClick={() => duplicar(false)} disabled={ocupado}>
              Sumar lo que falte (conserva mis cantidades)
            </button>
            <button type="button" className="min-h-11 text-sm font-semibold text-slate-600" onClick={() => setConfirmarDuplicar(false)} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </Hoja>
      )}
    </>
  )
}
