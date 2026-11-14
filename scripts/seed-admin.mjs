// Crea (o corrige) la primera cuenta admin. Se corre UNA vez, desde tu computador:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ADMIN_EMAIL=… npm run seed:admin
// Si la cuenta ya existe en Supabase Auth, solo le crea el perfil admin.
// Si no existe, la crea (requiere ADMIN_PASSWORD).
import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD } = process.env
const terminar = (m) => {
  console.error(`✗ ${m}`)
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) terminar('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
if (!ADMIN_EMAIL) terminar('Falta ADMIN_EMAIL.')
const email = ADMIN_EMAIL.trim().toLowerCase()

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function buscarUsuario() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) terminar(error.message)
    const u = data.users.find((x) => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

let usuario = await buscarUsuario()
if (!usuario) {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) terminar('La cuenta no existe: define ADMIN_PASSWORD (8+ caracteres) para crearla.')
  const { data, error } = await sb.auth.admin.createUser({ email, password: ADMIN_PASSWORD, email_confirm: true })
  if (error) terminar(error.message)
  usuario = data.user
  console.log('✓ Cuenta creada en Supabase Auth')
}

const { data: otra } = await sb.from('perfiles').select('id, nombre').eq('rol', 'admin').neq('id', usuario.id).maybeSingle()
if (otra) terminar(`Ya hay otra admin (${otra.nombre}). El rol se traspasa desde la app, en Usuarias.`)

const { data: actual } = await sb.from('perfiles').select('nombre').eq('id', usuario.id).maybeSingle()
const nombre = ADMIN_NOMBRE?.trim() || actual?.nombre || email.split('@')[0]
const { error } = await sb.from('perfiles').upsert({ id: usuario.id, nombre, email, rol: 'admin', activo: true })
if (error) terminar(error.message)
console.log(`✓ ${email} quedó como admin (${nombre}).`)
