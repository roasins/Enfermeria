import { Check, ChevronRight, Plus, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cargando, Codigo, ErrorCaja, Vacio } from '../componentes/Basicos'
import { DialogoCantidad } from '../componentes/DialogoCantidad'
import { useAvisos } from '../contexto/Avisos'
import { useBorrador } from '../contexto/Borrador'
import { useCatalogo } from '../contexto/Catalogo'
import { usePerfil } from '../contexto/Sesion'
import { buscarInsumos } from '../lib/buscar'
import { fecha } from '../lib/formato'
import { leerCerrados } from '../lib/pedidos'
import { calcularSugerencias } from '../lib/sugerencias'
import type { Insumo, Pedido } from '../lib/tipos'

export function NuevoPedido() {
  const perfil = usePerfil()
  const catalogo = useCatalogo()
  const borrador = useBorrador()
  const { avisar, fallar } = useAvisos()
  const [consulta, setConsulta] = useState('')
  const [elegido, setElegido] = useState<Insumo | null>(null)
  const [ultimos, setUltimos] = useState<Pedido[] | null>(null)
  const [repitiendo, setRepitiendo] = useState(false)

  useEffect(() => {
    leerCerrados({ usuarioId: perfil.id, limite: 6 })
      .then(setUltimos)
      .catch(() => setUltimos([]))
  }, [perfil.id])

  const resultados = useMemo(() => (consulta.trim() ? buscarInsumos(catalogo.activos, consulta) : []), [catalogo.activos, consulta])

  const sugerencias = useMemo(
    () =>
      calcularSugerencias(
        (ultimos ?? []).map((p) => ({ cerrado_en: p.cerrado_en, items: p.pedido_items })),
        { permitidos: (id) => catalogo.porId.get(id)?.activo === true },
      ),
    [ultimos, catalogo.porId],
  )
  const habitual = (id: string) => sugerencias.find((s) => s.insumo_id === id)?.cantidad

  const agregar = async (insumo: Insumo, cantidad: number) => {
    setElegido(null)
    try {
      await borrador.poner(insumo.id, cantidad)
      avisar(`Agregado: ${cantidad} ${insumo.unidad}`)
    } catch {
      /* el aviso ya se mostró */
    }
  }

  const ultimo = ultimos?.[0]
  const repetirUltimo = async () => {
    if (!ultimo) return
    const lista = ultimo.pedido_items.filter((i) => catalogo.porId.get(i.insumo_id)?.activo).map((i) => ({ insumo_id: i.insumo_id, cantidad: i.cantidad }))
    const omitidos = ultimo.pedido_items.length - lista.length
    setRepitiendo(true)
    try {
      await borrador.ponerVarios(lista)
      avisar(`Se agregaron los insumos del ${fecha(ultimo.cerrado_en!)}${omitidos ? ` (${omitidos} ya no están en el catálogo)` : ''}`)
    } catch (e) {
      fallar(e)
    } finally {
      setRepitiendo(false)
    }
  }

  if (catalogo.cargando || borrador.cargando) return <Cargando />

  return (
    <>
      <div className="sticky top-12 z-20 -mx-4 bg-slate-50 px-4 pt-1 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
          <input
            className="campo h-14 pr-12 pl-11 !text-lg shadow-sm"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Buscar por nombre o código"
            aria-label="Buscar insumo por nombre o código"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
          />
          {consulta && (
            <button type="button" onClick={() => setConsulta('')} aria-label="Borrar búsqueda" className="absolute top-1/2 right-1.5 grid size-11 -translate-y-1/2 place-items-center rounded-full text-slate-500">
              <X className="size-5" />
            </button>
          )}
        </div>
      </div>

      {catalogo.error && <ErrorCaja>{catalogo.error}</ErrorCaja>}

      {consulta.trim() ? (
        resultados.length === 0 ? (
          <Vacio titulo="Sin resultados">Prueba con otra palabra o con parte del código.</Vacio>
        ) : (
          <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
            {resultados.map((insumo) => {
              const enPedido = borrador.cantidadDe(insumo.id)
              return (
                <li key={insumo.id}>
                  <button type="button" onClick={() => setElegido(insumo)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-100">
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug font-semibold">{insumo.nombre}</span>
                      <span className="mt-0.5 block text-sm">
                        <Codigo codigo={insumo.codigo} /> <span className="text-slate-400">·</span> <span className="text-slate-500">{insumo.unidad}</span>
                      </span>
                    </span>
                    {enPedido > 0 ? (
                      <span className="shrink-0 rounded-lg bg-teal-50 px-2.5 py-1.5 text-sm font-bold whitespace-nowrap text-teal-800">
                        {enPedido} {insumo.unidad}
                      </span>
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-700 text-white">
                        <Plus className="size-5" />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <section>
          <div className="mb-2 flex items-end justify-between gap-2">
            <h2 className="text-lg font-bold">Lo que sueles pedir</h2>
            {ultimos && ultimos.length > 0 && <span className="text-xs text-slate-500">según tus últimos {ultimos.length === 1 ? 'pedido' : `${ultimos.length} pedidos`}</span>}
          </div>
          {ultimos === null ? (
            <Cargando />
          ) : sugerencias.length === 0 ? (
            <Vacio titulo="Aún no hay sugerencias">Cuando cierres tu primer pedido, aquí aparecerán tus insumos habituales. Por ahora, usa el buscador de arriba.</Vacio>
          ) : (
            <>
              {ultimo && (
                <button type="button" className="btn-claro mb-3 w-full" onClick={repetirUltimo} disabled={repitiendo}>
                  <RotateCcw className="size-5" /> {repitiendo ? 'Agregando…' : `Repetir último pedido (${fecha(ultimo.cerrado_en!)})`}
                </button>
              )}
              <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
                {sugerencias.map((s) => {
                  const insumo = catalogo.porId.get(s.insumo_id)!
                  const enPedido = borrador.cantidadDe(insumo.id)
                  return (
                    <li key={insumo.id} className="flex items-center gap-2 py-2 pr-3 pl-4">
                      <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => setElegido(insumo)}>
                        <span className="block leading-snug font-semibold">{insumo.nombre}</span>
                        <span className="mt-0.5 block text-sm text-slate-500">
                          <Codigo codigo={insumo.codigo} /> · en {s.veces} de {ultimos.length}
                        </span>
                      </button>
                      {enPedido > 0 ? (
                        <button type="button" onClick={() => setElegido(insumo)} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-teal-50 px-3 text-sm font-bold whitespace-nowrap text-teal-800">
                          <Check className="size-4" /> {enPedido} {insumo.unidad}
                        </button>
                      ) : (
                        <button type="button" onClick={() => agregar(insumo, s.cantidad)} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-3 text-sm font-bold whitespace-nowrap text-white active:scale-95" aria-label={`Agregar ${s.cantidad} ${insumo.unidad} de ${insumo.nombre}`}>
                          <Plus className="size-4" /> {s.cantidad} {insumo.unidad}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {borrador.items.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 px-4 pb-3">
          <Link to="/pedido" className="btn-primario mx-auto flex w-full max-w-2xl justify-between shadow-lg">
            <span>
              Pedido en curso · {borrador.items.length} {borrador.items.length === 1 ? 'línea' : 'líneas'}
            </span>
            <ChevronRight className="size-5" />
          </Link>
        </div>
      )}

      {elegido && (
        <DialogoCantidad
          insumo={elegido}
          actual={borrador.cantidadDe(elegido.id)}
          sugerida={habitual(elegido.id)}
          onCerrar={() => setElegido(null)}
          onGuardar={(n) => agregar(elegido, n)}
          onQuitar={() => {
            void borrador.quitar(elegido.id)
            setElegido(null)
          }}
        />
      )}
    </>
  )
}
