/** Quita tildes y mayúsculas: "Apósito" → "aposito", "PAÑAL" → "panal". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

interface Buscable {
  codigo: string | null
  nombre: string
}

/**
 * Buscador instantáneo por nombre o código.
 * - No distingue tildes ni mayúsculas.
 * - Por palabras parciales y en cualquier orden: "aguj 21" encuentra "AGUJA DESECH 21 GX1 1/2".
 * - Sin texto, devuelve todo ordenado por nombre.
 * Orden: primero coincidencia de código, luego nombres que empiezan con lo escrito, luego el resto.
 */
export function buscarInsumos<T extends Buscable>(insumos: T[], consulta: string, limite = 60): T[] {
  const q = normalizar(consulta)
  const palabras = q.split(/\s+/).filter(Boolean)
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
  if (palabras.length === 0) return [...insumos].sort(porNombre).slice(0, limite)

  const encontrados: { insumo: T; puntos: number }[] = []
  for (const insumo of insumos) {
    const codigo = normalizar(insumo.codigo ?? '')
    const nombre = normalizar(insumo.nombre)
    const todo = `${codigo} ${nombre}`
    if (!palabras.every((p) => todo.includes(p))) continue
    let puntos = 4
    if (codigo && codigo === q) puntos = 0
    else if (codigo && codigo.startsWith(q)) puntos = 1
    else if (nombre.startsWith(q)) puntos = 2
    else {
      const inicios = nombre.split(/[^a-z0-9]+/)
      if (palabras.every((p) => inicios.some((w) => w.startsWith(p)))) puntos = 3
    }
    encontrados.push({ insumo, puntos })
  }
  return encontrados
    .sort((a, b) => a.puntos - b.puntos || porNombre(a.insumo, b.insumo))
    .slice(0, limite)
    .map((e) => e.insumo)
}
