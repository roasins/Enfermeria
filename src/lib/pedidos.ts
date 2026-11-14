import { CAMPOS_PEDIDO } from '../contexto/Borrador'
import { supabase } from './supabase'
import type { Pedido } from './tipos'

/** Pedidos cerrados, del más nuevo al más antiguo. Sin usuaria = todos los que la sesión puede ver. */
export async function leerCerrados(opciones: { usuarioId?: string | null; desde?: Date | null; limite?: number } = {}): Promise<Pedido[]> {
  let q = supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('estado', 'cerrado').order('cerrado_en', { ascending: false })
  if (opciones.usuarioId) q = q.eq('usuario_id', opciones.usuarioId)
  if (opciones.desde) q = q.gte('cerrado_en', opciones.desde.toISOString())
  q = q.limit(opciones.limite ?? 500)
  const { data, error } = await q
  if (error) throw error
  return data as Pedido[]
}

export async function leerPedido(id: string): Promise<Pedido | null> {
  const { data, error } = await supabase.from('pedidos').select(CAMPOS_PEDIDO).eq('id', id).maybeSingle()
  if (error) throw error
  return data as Pedido | null
}
