import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cargando, Codigo, Titulo, Vacio } from '../componentes/Basicos'
import { DialogoCantidad } from '../componentes/DialogoCantidad'
import { Hoja } from '../componentes/Hoja'
import { useAvisos } from '../contexto/Avisos'
import { useBorrador } from '../contexto/Borrador'
import { useCatalogo } from '../contexto/Catalogo'
import { lineasDePedido } from '../lib/lineas'
import type { Insumo } from '../lib/tipos'

export function PedidoEnCurso() {
  const catalogo = useCatalogo()
  const borrador = useBorrador()
  const { avisar, fallar } = useAvisos()
  const navegar = useNavigate()
  const [editando, setEditando] = useState<Insumo | null>(null)
  const [confirmar, setConfirmar] = useState<'cerrar' | 'vaciar' | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const lineas = useMemo(() => lineasDePedido(borrador.items, catalogo.porId), [borrador.items, catalogo.porId])
  const pendientes = lineas.filter((l) => l.codigoPendiente).length

  if (catalogo.cargando || borrador.cargando) return <Cargando />

  const cambiar = (id: string, cantidad: number) => {
    if (cantidad < 1) return
    borrador.poner(id, cantidad).catch(() => {})
  }

  const cerrar = async () => {
    setOcupado(true)
    try {
      const cerrado = await borrador.cerrar()
      avisar('Pedido cerrado')
      navegar(`/historial/${cerrado.id}`, { replace: true, state: { recienCerrado: true } })
    } catch (e) {
      fallar(e)
      setOcupado(false)
      setConfirmar(null)
    }
  }

  const vaciar = async () => {
    setOcupado(true)
    try {
      await borrador.descartar()
      avisar('Pedido vaciado')
      navegar('/', { replace: true })
    } catch (e) {
      fallar(e)
      setOcupado(false)
      setConfirmar(null)
    }
  }

  return (
    <>
      <Link to="/" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-teal-700">
        <ArrowLeft className="size-4" /> Seguir agregando
      </Link>
      <Titulo>Pedido en curso</Titulo>

      {lineas.length === 0 ? (
        <Vacio titulo="El pedido está vacío">
          <Link to="/" className="font-semibold text-teal-700 underline">
            Busca un insumo
          </Link>{' '}
          para empezar.
        </Vacio>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            <strong className="text-slate-900">
              {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}
            </strong>{' '}
            · se guarda automáticamente
            {pendientes > 0 && (
              <>
                {' '}
                · <span className="font-semibold text-amber-700">{pendientes} con código pendiente</span>
              </>
            )}
          </p>
          <ul className="tarjeta divide-y divide-slate-100">
            {lineas.map((l) => (
              <li key={l.insumo_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="leading-snug font-semibold">{l.material}</p>
                    <p className="mt-0.5 text-sm">
                      <Codigo codigo={l.codigo} />
                    </p>
                  </div>
                  <button type="button" onClick={() => borrador.quitar(l.insumo_id)} aria-label={`Quitar ${l.material}`} className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" className="btn-claro size-11 !min-h-11 !px-0" disabled={l.cantidad <= 1} onClick={() => cambiar(l.insumo_id, l.cantidad - 1)} aria-label="Restar uno">
                    <Minus className="size-5" />
                  </button>
                  <button type="button" onClick={() => setEditando(catalogo.porId.get(l.insumo_id) ?? null)} className="min-h-11 min-w-28 rounded-xl border border-slate-300 bg-white px-3 text-lg font-bold tabular-nums" aria-label={`Cambiar cantidad de ${l.material}`}>
                    {l.cantidad} <span className="text-sm font-semibold text-slate-500">{l.unidad}</span>
                  </button>
                  <button type="button" className="btn-claro size-11 !min-h-11 !px-0" onClick={() => cambiar(l.insumo_id, l.cantidad + 1)} aria-label="Sumar uno">
                    <Plus className="size-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label className="etiqueta mt-5" htmlFor="nota">
            Nota (opcional)
          </label>
          <textarea id="nota" className="campo py-2.5" rows={2} maxLength={300} placeholder="Ej.: pedido quincena 2 de noviembre" defaultValue={borrador.pedido?.nota ?? ''} onBlur={(e) => borrador.guardarNota(e.target.value)} />

          <button type="button" className="btn-primario mt-5 w-full" onClick={() => setConfirmar('cerrar')}>
            Cerrar pedido ({lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'})
          </button>
          <button type="button" className="mt-2 min-h-11 w-full text-sm font-semibold text-red-700" onClick={() => setConfirmar('vaciar')}>
            Vaciar pedido
          </button>
        </>
      )}

      {editando && (
        <DialogoCantidad
          insumo={editando}
          actual={borrador.cantidadDe(editando.id)}
          onCerrar={() => setEditando(null)}
          onGuardar={(n) => {
            cambiar(editando.id, n)
            setEditando(null)
          }}
          onQuitar={() => {
            void borrador.quitar(editando.id)
            setEditando(null)
          }}
        />
      )}

      {confirmar === 'cerrar' && (
        <Hoja titulo="¿Cerrar el pedido?" onCerrar={() => !ocupado && setConfirmar(null)}>
          <p className="text-slate-600">
            Son {lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'}. Un pedido cerrado ya no se edita (se puede duplicar). Después podrás descargar el Excel.
          </p>
          {pendientes > 0 && <p className="mt-2 text-sm font-medium text-amber-700">{pendientes} {pendientes === 1 ? 'insumo va' : 'insumos van'} con CÓDIGO PENDIENTE.</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-claro flex-1" onClick={() => setConfirmar(null)} disabled={ocupado}>
              Volver
            </button>
            <button type="button" className="btn-primario flex-1" onClick={cerrar} disabled={ocupado}>
              {ocupado ? 'Cerrando…' : 'Cerrar pedido'}
            </button>
          </div>
        </Hoja>
      )}
      {confirmar === 'vaciar' && (
        <Hoja titulo="¿Vaciar el pedido?" onCerrar={() => !ocupado && setConfirmar(null)}>
          <p className="text-slate-600">Se quitarán las {lineas.length} líneas del pedido en curso. Esto no se puede deshacer.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-claro flex-1" onClick={() => setConfirmar(null)} disabled={ocupado}>
              Volver
            </button>
            <button type="button" className="btn-peligro flex-1" onClick={vaciar} disabled={ocupado}>
              Vaciar
            </button>
          </div>
        </Hoja>
      )}
    </>
  )
}
