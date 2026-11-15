# Puesta en marcha

Todo esto se hace una sola vez. Usa **solo el proyecto Supabase de enfermería**.

> Atajo: si conectas el proyecto Supabase de enfermería a Claude, los pasos 1 a 3 los puede hacer Claude.

## 1. Supabase: base de datos
1. Supabase → proyecto de enfermería → **SQL Editor** → New query.
2. Pega el contenido completo de `supabase/instalar.sql` y aprieta **Run**.
   (Crea las tablas, los permisos y carga los 220 insumos. Es lo mismo que las migraciones de `supabase/migrations/`.)

### Actualizaciones de la base de datos
Si la base ya estaba instalada y se agrega un archivo nuevo en `supabase/migrations/`, pega solo ese archivo en el
SQL Editor y aprieta Run. Hasta ahora: `20261115000001_borrar_pedidos.sql` (permite borrar pedidos cerrados).

## 2. Supabase: cuenta admin
La cuenta de la admin ya existe en Authentication → Users. Falta marcarla como admin en la app.
En **SQL Editor**, cambia el correo y el nombre y aprieta Run:

```sql
insert into public.perfiles (id, nombre, email, rol)
select id, 'NOMBRE Y APELLIDO', email, 'admin' from auth.users where email = 'CORREO_DE_LA_ADMIN'
on conflict (id) do update set rol = 'admin', activo = true;
```

Debe responder "1 row". Alternativa con script (crea la cuenta si no existe): copiar `.env.example` a `.env`,
completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` (y `ADMIN_PASSWORD` si la cuenta es nueva) y correr
`npm install` y `npm run seed:admin`.

## 3. Supabase: función para crear cuentas
Sin este paso todo funciona, salvo la pantalla "Usuarias" (crear, desactivar, cambiar contraseña).

- **Desde el panel:** Edge Functions → Deploy a new function → Via Editor. Nombre exacto: `admin-usuarias`.
  Pega el contenido de `supabase/functions/admin-usuarias/index.ts`, desactiva **Verify JWT** (la función revisa ella
  misma que quien llama sea la admin) y Deploy.
- **O por terminal:** `npx supabase login` y luego
  `npx supabase functions deploy admin-usuarias --project-ref REF_DEL_PROYECTO --no-verify-jwt`

No hay que agregar secretos: Supabase ya le entrega `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Supabase: Authentication
- Sign In / Providers → **Allow new users to sign up: desactivado** (no hay registro público).
- Sign In / Providers → Email: activado. "Confirm email" puede quedar como esté (las cuentas se crean confirmadas).
- URL Configuration → **Site URL:** la dirección final de la app (ej. `https://enfermeria.pulsonexo.cl`).
- URL Configuration → **Redirect URLs:** `https://enfermeria.pulsonexo.cl/**` y la dirección
  `https://pedidos-enfermeria.TU-SUBDOMINIO.workers.dev/**` que entrega Cloudflare.

## 5. Datos que vas a necesitar (Supabase → Project Settings → API Keys / Data API)
- **Project URL** → `VITE_SUPABASE_URL`
- **Publishable key** (`sb_publishable_…`; también sirve la `anon`) → `VITE_SUPABASE_PUBLISHABLE_KEY`
- Nunca pongas la `service_role` / secret key en Cloudflare ni en el código.

## 6. Cloudflare Workers
1. Workers & Pages → Create → **Import a repository** → `roasins/Enfermeria`.
2. **Project name / Worker name:** `pedidos-enfermeria` (debe ser igual al `name` de `wrangler.jsonc`).
3. **Production branch:** `main`. (Hoy el código está en la rama `claude/festive-brown-r43adz`: crea `main` desde esa
   rama en GitHub, o elige esa rama aquí.)
4. **Build command:** `npm run build`
5. **Deploy command:** `npx wrangler deploy`
6. **Root directory:** `/` (vacío).
7. **Variables de build** (Settings → Build → Variables and secrets):
   - `VITE_SUPABASE_URL` = Project URL del paso 5
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Publishable key del paso 5

   Son variables de *build* (no de runtime). Si las cambias, hay que volver a publicar (Retry deployment).
8. La versión de Node la fija el archivo `.node-version` (22).
9. **Dominio:** Settings → Domains & Routes → Add → Custom domain → `enfermeria.pulsonexo.cl`
   (o usa la dirección `workers.dev`). Después vuelve al paso 4 y revisa Site URL y Redirect URLs.

## 7. Probar
1. Abre la app y entra con la cuenta admin.
2. Catálogo → "Pendientes": deben aparecer 11 insumos por completar.
3. Usuarias → Nueva: crea una cuenta de prueba (confirma que el paso 3 quedó bien).
4. En el celular: menú del navegador → "Agregar a pantalla de inicio" / "Instalar app".

## Desarrollo local
```bash
npm install
cp .env.example .env   # completar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
npm test               # buscador, sugerencias, estadísticas y Excel
npm run build
```
