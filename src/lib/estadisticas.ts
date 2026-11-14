export interface FilaEstadistica {
  insumo_id: string
  /** En cuántos pedidos aparece. */
  pedidos: number
  /** Suma de cantidades. */
  total: number
  /** Cantidad promedio por pedido en que aparece (1 decimal). */
  promedio: number
}

export type Periodo = '3m' | '6m' | '12m' | 'todo'
export const PERIODOS: { valor: Periodo; nombre: string }[] = [
  { valor: '3m', nombre: 'Últimos 3 meses' },
  { valor: '6m', nombre: 'Últimos 6 meses' },
  { valor: '12m', nombre: 'Último año' },
  { valor: 'todo', nombre: 'Todo' },
]

/** Fecha desde la que cuenta el período (null = sin límite). */
export function inicioPeriodo(periodo: Periodo, hoy = new Date()): Date | null {
  if (periodo === 'todo') return null
  const d = new Date(hoy)
  d.setMonth(d.getMonth() - { '3m': 3, '6m': 6, '12m': 12 }[periodo])
  return d
}

/** Insumos más pedidos: primero los que aparecen en más pedidos; a igualdad, mayor cantidad total. */
export function calcularEstadisticas(pedidos: { items: { insumo_id: string; cantidad: number }[] }[]): FilaEstadistica[] {
  const acc = new Map<string, { pedidos: number; total: number }>()
  for (const pedido of pedidos) {
    for (const item of pedido.items) {
      const a = acc.get(item.insumo_id) ?? { pedidos: 0, total: 0 }
      a.pedidos += 1
      a.total += item.cantidad
      acc.set(item.insumo_id, a)
    }
  }
  return [...acc.entries()]
    .map(([insumo_id, a]) => ({ insumo_id, ...a, promedio: Math.round((a.total / a.pedidos) * 10) / 10 }))
    .sort((a, b) => b.pedidos - a.pedidos || b.total - a.total)
}
