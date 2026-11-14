import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Pedido, PedidoItem } from '../lib/tipos'
import { useAvisos } from './Avisos'
import { usePerfil } from './Sesion'

export const CAMPOS_PEDIDO = 'id, usuario_id, estado, creado_en, cerrado_en, numero_sap, nota, pedido_items(pedido_id, insumo_id, cantidad, cargado_sap)'

interface Borrador {
  cargando: boolean
  /** El borrador activo (null si todavía no se agrega nada). */
  pedido: Pedido | null
  items: PedidoItem[]
  /** Cantidad en el borrador, por insumo. */
  cantidadDe: (insumoId: string) => number
  /** Agrega el insumo o cambia su cantidad. Se guarda al instante. */
  poner: (insumoId: string, cantidad: number) => Promise<void>
  quitar: (insumoId: string) => Promise<void>
  /** Agrega varios de una vez. Con reemplazar, parte de cero; si no, respeta lo que ya está. */
  ponerVarios: (lista: { insumo_id: string; cantidad: number }[], reemplazar?: boolean) => Promise<void>
  guardarNota: (nota: string) => Promise<void>
  /** Cierra el pedido y lo devuelve. */
  cerrar: () => Promise<Pedido>
  descartar: () => Promise<void>
  recargar: () => Promise<void>
}
const Ctx = createContext<Borrador | null>(null)

export function BorradorProvider({ children }: { children: ReactNode }) {
  const perfil = usePerfil()
  const { fallar } = useAvisos()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [cargando, setCargando] = useState(true)
  const creando = useRef<Promise<Pedido> | null>(null)

  const leer = useCallback(async (): Promise<Pedido | null> => {
    const { data, error } = await supabase
      .from('pedidos')
      .select(CAMPOS_PEDIDO)
      .eq('usuario_id', perfil.id)
      .eq('estado', 'borrador')
      .maybeSingle()
    if (error) throw error
    return data as Pedido | null
  }, [perfil.id])

  const recargar = useCallback(async () => {
    try {
      setPedido(await leer())
    } catch (e) {
      fallar(e)
    } finally {
      setCargando(false)
    }
  }, [leer, fallar])

  useEffect(() => {
    void recargar()
  }, [recargar])

  /** Devuelve el borrador; si no existe, lo crea (uno solo por usuaria). */
  const asegurar = useCallback(async (): Promise<Pedido> => {
    if (pedido) return pedido
    if (!creando.current) {
      creando.current = (async () => {
        const { data, error } = await supabase.from('pedidos').insert({ usuario_id: perfil.id }).select(CAMPOS_PEDIDO).single()
        if (!error) return data as Pedido
        // Ya había un borrador (por ejemplo, creado desde otro teléfono): se usa ese.
        const existente = error.code === '23505' ? await leer() : null
        if (!existente) throw error
        return existente
      })().finally(() => {
        creando.current = null
      })
    }
    const nuevo = await creando.current
    setPedido((p) => p ?? nuevo)
    return nuevo
  }, [pedido, perfil.id, leer])

  const cambiarItems = (fn: (items: PedidoItem[]) => PedidoItem[]) =>
    setPedido((p) => (p ? { ...p, pedido_items: fn(p.pedido_items) } : p))

  const poner = useCallback(
    async (insumoId: string, cantidad: number) => {
      try {
        const p = await asegurar()
        const fila = { pedido_id: p.id, insumo_id: insumoId, cantidad }
        cambiarItems((items) =>
          items.some((i) => i.insumo_id === insumoId)
            ? items.map((i) => (i.insumo_id === insumoId ? { ...i, cantidad } : i))
            : [...items, { ...fila, cargado_sap: false }],
        )
        const { error } = await supabase.from('pedido_items').upsert(fila, { onConflict: 'pedido_id,insumo_id' })
        if (error) throw error
      } catch (e) {
        fallar(e)
        await recargar()
        throw e
      }
    },
    [asegurar, fallar, recargar],
  )

  const quitar = useCallback(
    async (insumoId: string) => {
      if (!pedido) return
      cambiarItems((items) => items.filter((i) => i.insumo_id !== insumoId))
      const { error } = await supabase.from('pedido_items').delete().eq('pedido_id', pedido.id).eq('insumo_id', insumoId)
      if (error) {
        fallar(error)
        await recargar()
      }
    },
    [pedido, fallar, recargar],
  )

  const ponerVarios = useCallback(
    async (lista: { insumo_id: string; cantidad: number }[], reemplazar = false) => {
      try {
        const p = await asegurar()
        if (reemplazar) {
          const { error } = await supabase.from('pedido_items').delete().eq('pedido_id', p.id)
          if (error) throw error
        }
        if (lista.length) {
          const filas = lista.map((l) => ({ pedido_id: p.id, insumo_id: l.insumo_id, cantidad: l.cantidad }))
          const { error } = await supabase.from('pedido_items').upsert(filas, { onConflict: 'pedido_id,insumo_id', ignoreDuplicates: true })
          if (error) throw error
        }
      } finally {
        await recargar()
      }
    },
    [asegurar, recargar],
  )

  const guardarNota = useCallback(
    async (nota: string) => {
      if (!pedido) return
      const valor = nota.trim() || null
      if (valor === pedido.nota) return
      setPedido((p) => (p ? { ...p, nota: valor } : p))
      const { error } = await supabase.from('pedidos').update({ nota: valor }).eq('id', pedido.id)
      if (error) fallar(error)
    },
    [pedido, fallar],
  )

  const cerrar = useCallback(async (): Promise<Pedido> => {
    if (!pedido) throw new Error('No hay pedido en curso')
    const { data, error } = await supabase.from('pedidos').update({ estado: 'cerrado' }).eq('id', pedido.id).select(CAMPOS_PEDIDO).single()
    if (error) throw error
    setPedido(null)
    return data as Pedido
  }, [pedido])

  const descartar = useCallback(async () => {
    if (!pedido) return
    const { error } = await supabase.from('pedidos').delete().eq('id', pedido.id)
    if (error) throw error
    setPedido(null)
  }, [pedido])

  const items = pedido?.pedido_items ?? []
  const cantidadDe = (id: string) => items.find((i) => i.insumo_id === id)?.cantidad ?? 0

  return (
    <Ctx.Provider value={{ cargando, pedido, items, cantidadDe, poner, quitar, ponerVarios, guardarNota, cerrar, descartar, recargar }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBorrador(): Borrador {
  const v = useContext(Ctx)
  if (!v) throw new Error('useBorrador fuera de BorradorProvider')
  return v
}
