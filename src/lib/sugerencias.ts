export interface PedidoHistorico {
  cerrado_en: string | null
  items: { insumo_id: string; cantidad: number }[]
}

export interface Sugerencia {
  insumo_id: string
  /** En cuántos de los últimos pedidos aparece. */
  veces: number
  /** Cantidad habitual (mediana). */
  cantidad: number
}

/** Mediana entera. Con cantidad par de valores, promedio de los dos del medio redondeado hacia arriba. */
export function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : Math.ceil((v[m - 1] + v[m]) / 2)
}

/** Los últimos N pedidos cerrados, del más nuevo al más antiguo. */
export function ultimosPedidos<T extends PedidoHistorico>(pedidos: T[], cuantos: number): T[] {
  return [...pedidos].sort((a, b) => (b.cerrado_en ?? '').localeCompare(a.cerrado_en ?? '')).slice(0, cuantos)
}

/**
 * "Lo que sueles pedir": insumos más frecuentes de los últimos pedidos cerrados, con su cantidad habitual.
 * Orden: más frecuentes primero; a igual frecuencia, lo pedido más recientemente.
 */
export function calcularSugerencias(
  pedidos: PedidoHistorico[],
  opciones: { ultimos?: number; maximo?: number; permitidos?: (insumoId: string) => boolean } = {},
): Sugerencia[] {
  const { ultimos = 6, maximo = 20, permitidos } = opciones
  const cantidades = new Map<string, number[]>()
  for (const pedido of ultimosPedidos(pedidos, ultimos)) {
    for (const item of pedido.items) {
      if (permitidos && !permitidos(item.insumo_id)) continue
      const lista = cantidades.get(item.insumo_id)
      if (lista) lista.push(item.cantidad)
      else cantidades.set(item.insumo_id, [item.cantidad])
    }
  }
  return [...cantidades.entries()]
    .map(([insumo_id, lista]) => ({ insumo_id, veces: lista.length, cantidad: mediana(lista) }))
    .sort((a, b) => b.veces - a.veces) // el orden de inserción (más reciente primero) desempata
    .slice(0, maximo)
}
