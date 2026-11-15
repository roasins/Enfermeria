# Supuestos

Decisiones que tomé donde el encargo no definía algo. Siempre elegí la opción más simple.

## Stack y despliegue
- No tuve acceso a pulso-mine, finanzas ni pulso-fire (solo a `pulso-nexo-web`). Usé el stack indicado para ese caso
  (Vite + React + TypeScript + Tailwind + Supabase) y copié de `pulso-nexo-web` la forma de publicar: `wrangler.jsonc`,
  Node 22 (`.node-version`), build `npm run build`, deploy `npx wrangler deploy`.
- El Worker se llama `pedidos-enfermeria` y solo sirve archivos estáticos (no tiene código propio).
- **No encontré el proyecto Supabase de enfermería** entre las conexiones de esta sesión (solo aparecían otros proyectos,
  que no toqué). Por eso la base de datos no quedó instalada: está todo listo en `supabase/` y los pasos en `DEPLOY.md`.
- Por lo mismo, la app no quedó publicada: falta conectar el repo en Cloudflare (ver `DEPLOY.md`).
- El repo estaba vacío; todo quedó en la rama `claude/festive-brown-r43adz` (no tenía permiso para crear `main`).
- Dominio sugerido: `enfermeria.pulsonexo.cl` (también sirve la dirección `*.workers.dev` que entrega Cloudflare).

## Cuentas
- Las enfermeras entran con correo y contraseña. La admin les crea la cuenta con una contraseña inicial y se la entrega
  en persona; cada una puede cambiarla en "Mi cuenta". No se envían correos (así no depende del correo de Supabase).
- Si una enfermera olvida su contraseña, la admin le pone una nueva desde "Usuarias".
- Desactivar una cuenta le impide entrar y ver datos, pero conserva sus pedidos. La cuenta admin no se puede desactivar:
  primero se traspasa el rol.
- Agregué la columna `email` a `perfiles` para que la admin reconozca las cuentas en la lista.
- La admin también puede armar sus propios pedidos (es una enfermera más).
- La admin ve los pedidos de todas, pero no los edita ni marca su carga a SAP (eso lo hace la dueña del pedido).

## Pedidos
- Se necesita internet para usar la app (cada cambio se guarda al instante en Supabase). "Instalable" significa que se
  agrega a la pantalla de inicio y abre como app; no funciona sin señal.
- Las líneas se ordenan por nombre del insumo, igual en pantalla, Excel y modo SAP. La posición (10, 20, 30…) sigue ese orden.
- Al tocar un insumo que ya está en el pedido, la cantidad que se escribe reemplaza a la anterior (no se suma).
- Cantidades: enteros de 1 a 99.999.
- Cada enfermera puede borrar sus propios pedidos cerrados (por ejemplo, uno cerrado por error), con confirmación.
  Al borrarlo deja de contar en sugerencias y estadísticas. La admin no borra pedidos de otras.
- No se puede cerrar un pedido vacío. El borrador se puede vaciar completo.
- Nota del pedido: se escribe antes de cerrar. Después de cerrar solo se puede guardar el número de pedido SAP.
- "Repetir último pedido" y "Duplicar" no copian insumos desactivados (avisa cuántos quedaron fuera).
- "Repetir último pedido" agrega lo que falte y respeta las cantidades que ya estén en el pedido en curso.
  "Duplicar", si ya hay un pedido en curso, pregunta si reemplazarlo o sumar lo que falte.
- Al cerrar no se descarga nada automáticamente (a pedido de Carlos): el Excel se baja con el botón "Excel" del
  pedido cerrado, que también está en el historial.

## Sugerencias y estadísticas
- "Lo que sueles pedir": hasta 20 insumos, ordenados por en cuántos de los últimos 6 pedidos cerrados aparecen.
  La cantidad habitual es la mediana; si hay dos valores al medio, su promedio redondeado hacia arriba.
- Estadísticas: períodos de 3, 6 y 12 meses o todo (por fecha de cierre). El promedio es la cantidad promedio por
  pedido en que aparece el insumo. Solo cuentan pedidos cerrados.

## Catálogo
- "Pendientes" = insumos activos sin código o cuyo nombre es "(NOMBRE PENDIENTE)".
- Los nombres se guardan en mayúsculas, como en SAP. Un insumo sin código exige nombre.
- El código duplicado se revisa contra todos los insumos, también los desactivados.
- Hay un tercer filtro, "Desactivados", para poder reactivarlos.
- El catálogo inicial (220 insumos) está en `supabase/catalogo-inicial.txt`; se puede cargar más de una vez sin duplicar.

## Excel
- Una hoja "Pedido": título, fecha, quién pidió, número SAP y nota (si existen) y la tabla Pos, Código, Material,
  Cantidad, Unidad. El código va como texto.
