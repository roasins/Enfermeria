# Pedidos de insumos — Enfermería

App web instalable (PWA), pensada para celular, en español de Chile. Las enfermeras arman el pedido quincenal de insumos
(buscan, ponen cantidad) y obtienen el pedido con sus códigos para digitarlo en SAP. No se conecta a SAP ni guarda datos
de pacientes.

- **Puesta en marcha:** `DEPLOY.md` · **Decisiones tomadas:** `SUPUESTOS.md`
- Stack: Vite + React + TypeScript + Tailwind, Supabase (Auth + Postgres + RLS), Cloudflare Workers (archivos estáticos).

## Dónde está cada cosa
- `src/paginas/` — pantallas: Login, NuevoPedido (buscador y sugerencias), PedidoEnCurso, Historial, DetallePedido,
  ModoSap, Estadisticas, Catalogo (admin), Usuarias (admin), Cuenta.
- `src/lib/` — lógica con pruebas: `buscar.ts`, `sugerencias.ts`, `estadisticas.ts`, `lineas.ts`, `excel.ts`.
- `src/contexto/` — sesión, catálogo, pedido en curso (borrador con guardado automático) y avisos.
- `supabase/migrations/` — tablas, reglas y permisos; `supabase/instalar.sql` es todo junto para pegar en el SQL Editor.
- `supabase/catalogo-inicial.txt` — catálogo inicial (`codigo|nombre|unidad`). Si cambia: `npm run seed:catalogo`
  y volver a juntar `instalar.sql` (`cat supabase/migrations/*.sql > supabase/instalar.sql`).
- `supabase/functions/admin-usuarias/` — Edge Function (service role) para crear y desactivar cuentas.
- `scripts/seed-admin.mjs` — crea la primera admin (lee `ADMIN_EMAIL`).
- `public/sw.js` — service worker (permite instalar la app).
- Actualizaciones: cada compilación genera `version.json`; la app lo revisa (`src/lib/version.ts`) y muestra la franja
  "Hay una versión nueva" con el botón Actualizar. También está en Mi cuenta → Buscar actualización.

## Comandos
`npm run dev` · `npm test` · `npm run build` (debe pasar sin errores antes de publicar)
