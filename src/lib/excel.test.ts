import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { filasExcel, generarExcel, nombreArchivoExcel } from './excel'
import { lineasDePedido } from './lineas'
import { CODIGO_PENDIENTE } from './tipos'

const insumos = new Map([
  ['a', { codigo: '200326', nombre: 'GASA CURACION 7,5X7,5CM ESTERIL, 2UN', unidad: 'C/U' as const }],
  ['b', { codigo: '250066', nombre: 'ALCOHOL 70%/250 ML C/ DOSIFICADOR', unidad: 'FCO' as const }],
  ['c', { codigo: null, nombre: 'PECHERA MANGA CORTA', unidad: 'C/U' as const }],
])
const items = [
  { insumo_id: 'a', cantidad: 40, cargado_sap: false },
  { insumo_id: 'c', cantidad: 3, cargado_sap: true },
  { insumo_id: 'b', cantidad: 6, cargado_sap: false },
]
const lineas = lineasDePedido(items, insumos)
const datos = { lineas, solicitante: 'Sofía Araya', fecha: '2026-11-14T15:00:00Z', numeroSap: '4500012345' }

describe('lineasDePedido', () => {
  it('ordena por nombre y numera 10, 20, 30…', () => {
    expect(lineas.map((l) => [l.pos, l.material.split(' ')[0]])).toEqual([[10, 'ALCOHOL'], [20, 'GASA'], [30, 'PECHERA']])
  })
  it('marca CÓDIGO PENDIENTE y conserva unidad y check SAP', () => {
    expect(lineas[2]).toMatchObject({ codigo: CODIGO_PENDIENTE, codigoPendiente: true, unidad: 'C/U', cargado_sap: true })
    expect(lineas[0]).toMatchObject({ codigo: '250066', codigoPendiente: false, unidad: 'FCO', cantidad: 6 })
  })
})

describe('Excel', () => {
  it('arma las filas con fecha, solicitante y columnas', () => {
    const f = filasExcel(datos)
    expect(f).toContainEqual(['Fecha', '14-11-2026'])
    expect(f).toContainEqual(['Pedido por', 'Sofía Araya'])
    expect(f).toContainEqual(['N° pedido SAP', '4500012345'])
    expect(f).toContainEqual(['Pos', 'Código', 'Material', 'Cantidad', 'Unidad'])
    expect(f.at(-1)).toEqual([30, CODIGO_PENDIENTE, 'PECHERA MANGA CORTA', 3, 'C/U'])
  })

  it('genera un .xlsx real que se puede volver a abrir', async () => {
    const buffer = await generarExcel(datos)
    const libro = new ExcelJS.Workbook()
    await libro.xlsx.load(buffer)
    const hoja = libro.getWorksheet('Pedido')!
    const filas: unknown[][] = []
    let filaTitulos = 0
    hoja.eachRow((r, n) => {
      filas.push((r.values as unknown[]).slice(1))
      if (r.getCell(1).value === 'Pos') filaTitulos = n
    })

    const iTitulos = filas.findIndex((f) => f[0] === 'Pos')
    expect(filas[iTitulos]).toEqual(['Pos', 'Código', 'Material', 'Cantidad', 'Unidad'])
    expect(filas.slice(iTitulos + 1)).toEqual([
      [10, '250066', 'ALCOHOL 70%/250 ML C/ DOSIFICADOR', 6, 'FCO'],
      [20, '200326', 'GASA CURACION 7,5X7,5CM ESTERIL, 2UN', 40, 'C/U'],
      [30, CODIGO_PENDIENTE, 'PECHERA MANGA CORTA', 3, 'C/U'],
    ])
    expect(filas.flat()).toContain('Sofía Araya')
    expect(filas.flat()).toContain('14-11-2026')
    // El código queda como texto y la cantidad como número.
    expect(typeof hoja.getCell(filaTitulos + 1, 2).value).toBe('string')
    expect(typeof hoja.getCell(filaTitulos + 1, 4).value).toBe('number')
  })

  it('nombre de archivo', () => {
    expect(nombreArchivoExcel(datos)).toBe('pedido-insumos-2026-11-14-sofia-araya.xlsx')
  })
})
