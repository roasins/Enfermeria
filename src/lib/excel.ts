import { fecha as formatoFecha } from './formato'
import type { LineaPedido } from './lineas'

export interface DatosExcel {
  lineas: LineaPedido[]
  solicitante: string
  fecha: string | Date
  numeroSap?: string | null
  nota?: string | null
}

export const COLUMNAS_EXCEL = ['Pos', 'Código', 'Material', 'Cantidad', 'Unidad'] as const
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Contenido de la hoja, fila por fila (función pura; fácil de probar). */
export function filasExcel(d: DatosExcel): (string | number)[][] {
  const filas: (string | number)[][] = [
    ['Pedido de insumos'],
    ['Fecha', formatoFecha(d.fecha)],
    ['Pedido por', d.solicitante],
  ]
  if (d.numeroSap) filas.push(['N° pedido SAP', d.numeroSap])
  if (d.nota) filas.push(['Nota', d.nota])
  filas.push([], [...COLUMNAS_EXCEL])
  for (const l of d.lineas) filas.push([l.pos, l.codigo, l.material, l.cantidad, l.unidad])
  return filas
}

/** Genera el .xlsx. ExcelJS se carga solo cuando se necesita, para que la app abra rápido. */
export async function generarExcel(d: DatosExcel): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default
  const libro = new ExcelJS.Workbook()
  libro.created = new Date(d.fecha)
  const hoja = libro.addWorksheet('Pedido')
  hoja.columns = [{ width: 8 }, { width: 20 }, { width: 52 }, { width: 11 }, { width: 9 }]

  const filas = filasExcel(d)
  const filaTitulos = filas.findIndex((f) => f[0] === COLUMNAS_EXCEL[0]) + 1
  filas.forEach((f) => hoja.addRow(f))

  hoja.getRow(1).font = { bold: true, size: 14 }
  for (let n = 2; n < filaTitulos - 1; n++) hoja.getCell(n, 1).font = { bold: true }
  const titulos = hoja.getRow(filaTitulos)
  titulos.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  for (let c = 1; c <= COLUMNAS_EXCEL.length; c++) {
    titulos.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
  }
  d.lineas.forEach((l, i) => {
    const fila = hoja.getRow(filaTitulos + 1 + i)
    fila.getCell(2).numFmt = '@' // el código es texto: no pierde ceros ni se convierte en número
    if (l.codigoPendiente) fila.getCell(2).font = { bold: true, color: { argb: 'FFB45309' } }
  })
  hoja.views = [{ state: 'frozen', ySplit: filaTitulos }]
  return (await libro.xlsx.writeBuffer()) as ArrayBuffer
}

/** pedido-insumos-2026-11-14-sofia-araya.xlsx */
export function nombreArchivoExcel(d: Pick<DatosExcel, 'fecha' | 'solicitante'>): string {
  const [dia, mes, anio] = formatoFecha(d.fecha).split('-')
  const quien = d.solicitante
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `pedido-insumos-${anio}-${mes}-${dia}${quien ? `-${quien}` : ''}.xlsx`
}

export async function descargarExcel(d: DatosExcel): Promise<void> {
  const blob = new Blob([await generarExcel(d)], { type: MIME })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivoExcel(d)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
