// Convierte supabase/catalogo-inicial.txt (codigo|nombre|unidad) en la migración SQL del catálogo inicial.
// Uso: npm run seed:catalogo
import { readFileSync, writeFileSync } from 'node:fs'

const origen = new URL('../supabase/catalogo-inicial.txt', import.meta.url)
const destino = new URL('../supabase/migrations/20261114000002_catalogo_inicial.sql', import.meta.url)
const q = (t) => `'${t.replaceAll("'", "''")}'`

const filas = readFileSync(origen, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const [codigo = '', nombre = '', unidad = ''] = l.split('|').map((p) => p.trim())
    return { codigo, nombre, unidad: unidad || 'C/U' }
  })

const conCodigo = filas.filter((f) => f.codigo)
const sinCodigo = filas.filter((f) => !f.codigo)

let sql = `-- Catálogo inicial de insumos (generado por scripts/generar-seed-catalogo.mjs; no editar a mano).
-- Se puede correr más de una vez: no duplica ni pisa lo que la admin ya corrigió.
insert into public.insumos (codigo, nombre, unidad) values
${conCodigo.map((f) => `  (${q(f.codigo)}, ${q(f.nombre)}, ${q(f.unidad)})`).join(',\n')}
on conflict (codigo) do nothing;
`
if (sinCodigo.length) {
  sql += `
-- Sin código todavía (salen como "CÓDIGO PENDIENTE").
insert into public.insumos (codigo, nombre, unidad)
select null, v.nombre, v.unidad
from (values
${sinCodigo.map((f) => `  (${q(f.nombre)}, ${q(f.unidad)})`).join(',\n')}
) as v (nombre, unidad)
where not exists (select 1 from public.insumos i where i.nombre = v.nombre);
`
}
writeFileSync(destino, sql)
console.log(`${filas.length} insumos (${sinCodigo.length} sin código) → ${destino.pathname}`)
