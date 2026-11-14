import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Perfil } from './tipos'

export async function leerPerfiles(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfiles').select('id, nombre, email, rol, activo').order('nombre')
  if (error) throw error
  return data as Perfil[]
}

/** Lista de cuentas (solo trae datos si la sesión es admin; para las demás devuelve solo la propia). */
export function usePerfiles(activo: boolean): Perfil[] {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  useEffect(() => {
    if (!activo) return
    let vigente = true
    leerPerfiles()
      .then((p) => vigente && setPerfiles(p))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [activo])
  return perfiles
}

/** Llama a la Edge Function de cuentas (solo admin). */
export async function accionUsuaria(cuerpo: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-usuarias', { body: cuerpo })
  if (error) {
    let detalle: string | undefined
    try {
      detalle = (await (error as { context?: Response }).context?.json())?.error
    } catch {
      /* sin detalle */
    }
    throw new Error(detalle ?? 'No se pudo completar la acción. Revisa que la función "admin-usuarias" esté publicada.')
  }
  if (data?.error) throw new Error(data.error)
}
