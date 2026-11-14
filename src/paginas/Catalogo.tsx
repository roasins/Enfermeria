import { Plus, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Cargando, Codigo, ErrorCaja, Titulo, Vacio } from '../componentes/Basicos'
import { Hoja } from '../componentes/Hoja'
import { useAvisos } from '../contexto/Avisos'
import { useCatalogo } from '../contexto/Catalogo'
import { buscarInsumos } from '../lib/buscar'
import { mensajeError } from '../lib/formato'
import { supabase } from '../lib/supabase'
import { esPendiente, NOMBRE_PENDIENTE, UNIDADES, type Insumo, type Unidad } from '../lib/tipos'

type Filtro = 'activos' | 'pendientes' | 'inactivos'

export function Catalogo() {
  const catalogo = useCatalogo()
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [editando, setEditando] = useState<Insumo | 'nuevo' | null>(null)

  const cuenta = useMemo(
    () => ({
      activos: catalogo.activos.length,
      pendientes: catalogo.activos.filter(esPendiente).length,
      inactivos: catalogo.insumos.length - catalogo.activos.length,
    }),
    [catalogo.insumos, catalogo.activos],
  )
  const lista = useMemo(() => {
    const base = filtro === 'inactivos' ? catalogo.insumos.filter((i) => !i.activo) : filtro === 'pendientes' ? catalogo.activos.filter(esPendiente) : catalogo.activos
    return buscarInsumos(base, consulta, 2000)
  }, [catalogo.insumos, catalogo.activos, filtro, consulta])

  if (catalogo.cargando) return <Cargando />

  return (
    <>
      <Titulo
        accion={
          <button type="button" className="btn-primario btn-chico" onClick={() => setEditando('nuevo')}>
            <Plus className="size-4" /> Nuevo
          </button>
        }
      >
        Catálogo
      </Titulo>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
        <input className="campo pl-11" type="search" autoComplete="off" placeholder="Buscar por nombre o código" aria-label="Buscar en el catálogo" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto" role="group" aria-label="Filtro">
        {(
          [
            ['activos', 'Activos'],
            ['pendientes', 'Pendientes'],
            ['inactivos', 'Desactivados'],
          ] as const
        ).map(([v, nombre]) => (
          <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${filtro === v ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
            {nombre} <span className={filtro === v ? 'text-teal-100' : 'text-slate-400'}>{cuenta[v]}</span>
          </button>
        ))}
      </div>
      {filtro === 'pendientes' && <p className="mb-3 text-sm text-slate-600">Insumos sin código o sin nombre real. Tócalos para completarlos.</p>}

      {lista.length === 0 ? (
        <Vacio titulo={filtro === 'pendientes' && !consulta ? 'No hay pendientes 🎉' : 'Sin resultados'} />
      ) : (
        <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
          {lista.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setEditando(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-100">
                <span className="min-w-0 flex-1">
                  <span className={`block leading-snug font-semibold ${i.nombre === NOMBRE_PENDIENTE ? 'text-amber-700' : ''} ${i.activo ? '' : 'text-slate-400 line-through'}`}>{i.nombre}</span>
                  <span className="mt-0.5 block text-sm">
                    <Codigo codigo={i.codigo} />
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-slate-500">{i.unidad}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando && <FormularioInsumo insumo={editando === 'nuevo' ? null : editando} onCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormularioInsumo({ insumo, onCerrar }: { insumo: Insumo | null; onCerrar: () => void }) {
  const catalogo = useCatalogo()
  const { avisar } = useAvisos()
  const [codigo, setCodigo] = useState(insumo?.codigo ?? '')
  const [nombre, setNombre] = useState(insumo && insumo.nombre !== NOMBRE_PENDIENTE ? insumo.nombre : '')
  const [unidad, setUnidad] = useState<Unidad>(insumo?.unidad ?? 'C/U')
  const [activo, setActivo] = useState(insumo?.activo ?? true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const codigoLimpio = codigo.trim()
  // Regla: el código no se puede repetir en otro insumo (activo o desactivado).
  const repetido = codigoLimpio ? catalogo.insumos.find((i) => i.id !== insumo?.id && i.codigo?.toLowerCase() === codigoLimpio.toLowerCase()) : undefined

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (repetido) return
    setGuardando(true)
    setError(null)
    const datos = { codigo: codigoLimpio || null, nombre: nombre.trim().toUpperCase() || NOMBRE_PENDIENTE, unidad, activo }
    const { error } = insumo ? await supabase.from('insumos').update(datos).eq('id', insumo.id) : await supabase.from('insumos').insert(datos)
    if (error) {
      setGuardando(false)
      setError(error.code === '23505' ? `El código ${codigoLimpio} ya existe en otro insumo.` : mensajeError(error))
      return
    }
    await catalogo.recargar()
    avisar(insumo ? 'Insumo guardado' : 'Insumo creado')
    onCerrar()
  }

  return (
    <Hoja titulo={insumo ? 'Editar insumo' : 'Nuevo insumo'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="i-codigo">
            Código SAP
          </label>
          <input id="i-codigo" className={`campo codigo ${repetido ? '!border-red-500' : ''}`} inputMode="numeric" autoComplete="off" maxLength={20} placeholder="Vacío = código pendiente" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          {repetido ? (
            <p className="mt-1 text-sm font-medium text-red-700">
              Ese código ya existe: {repetido.nombre}
              {repetido.activo ? '' : ' (desactivado)'}. No se puede repetir.
            </p>
          ) : (
            !codigoLimpio && <p className="mt-1 text-sm text-amber-700">Sin código saldrá como CÓDIGO PENDIENTE en los pedidos.</p>
          )}
        </div>
        <div>
          <label className="etiqueta" htmlFor="i-nombre">
            Nombre
          </label>
          <input id="i-nombre" className="campo uppercase" autoComplete="off" autoCapitalize="characters" maxLength={80} placeholder={insumo?.nombre === NOMBRE_PENDIENTE ? 'Nombre pendiente: escríbelo aquí' : 'Como aparece en SAP'} required={!codigoLimpio} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <span className="etiqueta">Unidad</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Unidad">
            {UNIDADES.map((u) => (
              <button key={u} type="button" role="radio" aria-checked={unidad === u} onClick={() => setUnidad(u)} className={`min-h-11 flex-1 rounded-xl border text-sm font-bold ${unidad === u ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
        {insumo && (
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 px-3">
            <span>
              <span className="block font-semibold">{activo ? 'Activo' : 'Desactivado'}</span>
              <span className="block text-sm text-slate-500">{activo ? 'Aparece en el buscador.' : 'No aparece en el buscador; sigue en pedidos antiguos.'}</span>
            </span>
            <input type="checkbox" className="size-6 accent-teal-700" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          </label>
        )}
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <button className="btn-primario w-full" disabled={guardando || Boolean(repetido)}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </Hoja>
  )
}
