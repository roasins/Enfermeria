import { describe, expect, it } from 'vitest'
import { calcularEstadisticas, inicioPeriodo } from './estadisticas'
import { calcularSugerencias, mediana } from './sugerencias'

const pedido = (dia: number, items: Record<string, number>) => ({
  cerrado_en: `2026-01-${String(dia).padStart(2, '0')}T12:00:00Z`,
  items: Object.entries(items).map(([insumo_id, cantidad]) => ({ insumo_id, cantidad })),
})

describe('mediana', () => {
  it('impar: el valor del medio', () => expect(mediana([10, 2, 5])).toBe(5))
  it('par: promedio de los dos del medio, hacia arriba', () => {
    expect(mediana([4, 10])).toBe(7)
    expect(mediana([1, 2])).toBe(2)
  })
  it('no se deja llevar por un pedido excepcional', () => expect(mediana([10, 10, 10, 10, 200])).toBe(10))
  it('vacío: 0', () => expect(mediana([])).toBe(0))
})

describe('calcularSugerencias', () => {
  it('ordena por frecuencia y usa la mediana como cantidad habitual', () => {
    const s = calcularSugerencias([pedido(1, { gasa: 10, aguja: 5 }), pedido(2, { gasa: 20 }), pedido(3, { gasa: 30, venda: 2 })])
    expect(s[0]).toEqual({ insumo_id: 'gasa', veces: 3, cantidad: 20 })
    expect(s.map((x) => x.insumo_id)).toEqual(['gasa', 'venda', 'aguja']) // empate: lo más reciente primero
  })
  it('solo mira los últimos 6 pedidos cerrados', () => {
    const viejos = [pedido(1, { antiguo: 99 }), pedido(2, { antiguo: 99 })]
    const nuevos = [3, 4, 5, 6, 7, 8].map((d) => pedido(d, { gasa: d }))
    const s = calcularSugerencias([...viejos, ...nuevos])
    expect(s).toEqual([{ insumo_id: 'gasa', veces: 6, cantidad: 6 }])
  })
  it('no depende del orden en que llegan los pedidos', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7].map((d) => pedido(d, { [`i${d}`]: 1 }))
    const ids = calcularSugerencias([...lista].reverse()).map((x) => x.insumo_id)
    expect(ids).not.toContain('i1')
    expect(ids[0]).toBe('i7')
  })
  it('deja fuera los insumos no permitidos (desactivados)', () => {
    const s = calcularSugerencias([pedido(1, { gasa: 1, viejo: 1 })], { permitidos: (id) => id !== 'viejo' })
    expect(s.map((x) => x.insumo_id)).toEqual(['gasa'])
  })
  it('respeta el máximo y funciona sin historial', () => {
    expect(calcularSugerencias([pedido(1, { a: 1, b: 1, c: 1 })], { maximo: 2 })).toHaveLength(2)
    expect(calcularSugerencias([])).toEqual([])
  })
})

describe('calcularEstadisticas', () => {
  it('cuenta pedidos, total y promedio', () => {
    const e = calcularEstadisticas([pedido(1, { gasa: 10, aguja: 5 }), pedido(2, { gasa: 15 }), pedido(3, { venda: 100 })])
    expect(e[0]).toEqual({ insumo_id: 'gasa', pedidos: 2, total: 25, promedio: 12.5 })
    expect(e.map((x) => x.insumo_id)).toEqual(['gasa', 'venda', 'aguja'])
  })
  it('período', () => {
    const hoy = new Date('2026-11-14T12:00:00Z')
    expect(inicioPeriodo('todo', hoy)).toBeNull()
    expect(inicioPeriodo('3m', hoy)!.toISOString().slice(0, 10)).toBe('2026-08-14')
    expect(inicioPeriodo('12m', hoy)!.toISOString().slice(0, 10)).toBe('2025-11-14')
  })
})
