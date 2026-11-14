import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'

interface Sesion {
  /** Todavía no se sabe si hay sesión. */
  cargando: boolean
  usuarioId: string | null
  correo: string | null
  perfil: Perfil | null
  /** Hay sesión pero no se pudo usar la cuenta (sin perfil, desactivada, sin conexión). */
  problema: string | null
  esAdmin: boolean
  salir: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [listo, setListo] = useState(false)
  const [usuario, setUsuario] = useState<{ id: string; correo: string | null } | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [perfilDe, setPerfilDe] = useState<string | null>(null)
  const [problema, setProblema] = useState<string | null>(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario((antes) => {
        const id = sesion?.user.id ?? null
        if (antes?.id === id) return antes
        return id ? { id, correo: sesion?.user.email ?? null } : null
      })
      setListo(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarPerfil = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('perfiles').select('id, nombre, email, rol, activo').eq('id', id).maybeSingle()
    if (error) setProblema('No se pudo cargar tu cuenta. Revisa tu conexión e inténtalo de nuevo.')
    else if (!data) setProblema('Tu cuenta todavía no está habilitada en esta app. Pídele a la administradora que la active.')
    else if (!data.activo) setProblema('Tu cuenta está desactivada. Habla con la administradora.')
    else setProblema(null)
    setPerfil(data && data.activo ? (data as Perfil) : null)
    setPerfilDe(id)
  }, [])

  useEffect(() => {
    if (usuario) void cargarPerfil(usuario.id)
    else {
      setPerfil(null)
      setPerfilDe(null)
      setProblema(null)
    }
  }, [usuario, cargarPerfil])

  const valor: Sesion = {
    cargando: !listo || (usuario !== null && perfilDe !== usuario.id),
    usuarioId: usuario?.id ?? null,
    correo: usuario?.correo ?? null,
    perfil,
    problema,
    esAdmin: perfil?.rol === 'admin',
    salir: async () => {
      await supabase.auth.signOut()
    },
    recargarPerfil: async () => {
      if (usuario) await cargarPerfil(usuario.id)
    },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion(): Sesion {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion fuera de SesionProvider')
  return v
}

/** Perfil de la usuaria con sesión iniciada (solo dentro de las pantallas privadas). */
export function usePerfil(): Perfil {
  const { perfil } = useSesion()
  if (!perfil) throw new Error('Sin sesión')
  return perfil
}
