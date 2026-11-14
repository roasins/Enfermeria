import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mensajeError } from '../lib/formato'
import { supabase } from '../lib/supabase'
import type { Insumo } from '../lib/tipos'

interface Catalogo {
  cargando: boolean
  error: string | null
  /** Todos los insumos, también los desactivados (para mostrar pedidos antiguos). */
  insumos: Insumo[]
  /** Solo los activos: los que aparecen en el buscador. */
  activos: Insumo[]
  porId: Map<string, Insumo>
  recargar: () => Promise<void>
}
const Ctx = createContext<Catalogo | null>(null)

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    const todos: Insumo[] = []
    // De a 1000 (límite por consulta de Supabase).
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, codigo, nombre, unidad, activo, creado_en')
        .order('nombre')
        .order('id')
        .range(desde, desde + 999)
      if (error) {
        setError(mensajeError(error))
        setCargando(false)
        return
      }
      todos.push(...(data as Insumo[]))
      if (data.length < 1000) break
    }
    setInsumos(todos)
    setError(null)
    setCargando(false)
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const valor = useMemo<Catalogo>(
    () => ({
      cargando,
      error,
      insumos,
      activos: insumos.filter((i) => i.activo),
      porId: new Map(insumos.map((i) => [i.id, i])),
      recargar,
    }),
    [cargando, error, insumos, recargar],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useCatalogo(): Catalogo {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCatalogo fuera de CatalogoProvider')
  return v
}
