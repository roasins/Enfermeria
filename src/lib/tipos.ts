export const UNIDADES = ['C/U', 'FCO', 'TUB', 'SOB', 'VAR'] as const
export type Unidad = (typeof UNIDADES)[number]

export const NOMBRE_PENDIENTE = '(NOMBRE PENDIENTE)'
export const CODIGO_PENDIENTE = 'CÓDIGO PENDIENTE'

export interface Insumo {
  id: string
  codigo: string | null
  nombre: string
  unidad: Unidad
  activo: boolean
  creado_en: string
}

export interface Perfil {
  id: string
  nombre: string
  email: string | null
  rol: 'admin' | 'enfermera'
  activo: boolean
}

export interface PedidoItem {
  pedido_id: string
  insumo_id: string
  cantidad: number
  cargado_sap: boolean
}

export interface Pedido {
  id: string
  usuario_id: string
  estado: 'borrador' | 'cerrado'
  creado_en: string
  cerrado_en: string | null
  numero_sap: string | null
  nota: string | null
  pedido_items: PedidoItem[]
}

/** Insumo que la admin todavía debe completar: sin código o sin nombre real. */
export function esPendiente(i: Pick<Insumo, 'codigo' | 'nombre'>): boolean {
  return !i.codigo || i.nombre.toUpperCase().includes('NOMBRE PENDIENTE')
}
