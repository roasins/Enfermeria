import { CODIGO_PENDIENTE, type Insumo, type PedidoItem } from './tipos'

/** Una línea del pedido lista para mostrar, exportar o cargar a SAP. */
export interface LineaPedido {
  insumo_id: string
  /** Posición SAP: 10, 20, 30… */
  pos: number
  /** Código SAP, o "CÓDIGO PENDIENTE". */
  codigo: string
  codigoPendiente: boolean
  material: string
  cantidad: number
  unidad: string
  cargado_sap: boolean
}

/** Ordena por nombre y numera de 10 en 10. Mismo orden en pantalla, Excel y modo SAP. */
export function lineasDePedido(
  items: Pick<PedidoItem, 'insumo_id' | 'cantidad' | 'cargado_sap'>[],
  insumos: Map<string, Pick<Insumo, 'codigo' | 'nombre' | 'unidad'>>,
): LineaPedido[] {
  return items
    .map((item) => {
      const insumo = insumos.get(item.insumo_id)
      return {
        insumo_id: item.insumo_id,
        pos: 0,
        codigo: insumo?.codigo || CODIGO_PENDIENTE,
        codigoPendiente: !insumo?.codigo,
        material: insumo?.nombre ?? '(insumo desconocido)',
        cantidad: item.cantidad,
        unidad: insumo?.unidad ?? 'C/U',
        cargado_sap: item.cargado_sap,
      }
    })
    .sort((a, b) => a.material.localeCompare(b.material, 'es', { numeric: true }) || a.codigo.localeCompare(b.codigo))
    .map((linea, i) => ({ ...linea, pos: (i + 1) * 10 }))
}
