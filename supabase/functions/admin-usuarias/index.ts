// Edge Function: gestión de cuentas (solo la admin). Usa la service role, que nunca llega al navegador.
// Acciones: crear | activar | clave | nombre
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fallo = (error: string, status = 400) => responder({ error }, status)

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fallo('Método no permitido', 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) ¿Quién llama? Debe ser la admin activa.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fallo('Falta iniciar sesión', 401)
  const { data: quien, error: errQuien } = await admin.auth.getUser(token)
  if (errQuien || !quien.user) return fallo('Sesión no válida', 401)
  const yo = quien.user.id
  const { data: miPerfil } = await admin.from('perfiles').select('rol, activo').eq('id', yo).maybeSingle()
  if (!miPerfil || miPerfil.rol !== 'admin' || !miPerfil.activo) return fallo('Solo la administradora puede hacer esto', 403)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return fallo('Solicitud mal formada')
  }
  const accion = texto(cuerpo.accion)

  if (accion === 'crear') {
    const email = texto(cuerpo.email).toLowerCase()
    const nombre = texto(cuerpo.nombre)
    const password = typeof cuerpo.password === 'string' ? cuerpo.password : ''
    if (!nombre) return fallo('Falta el nombre')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fallo('El correo no es válido')
    if (password.length < 8) return fallo('La contraseña debe tener al menos 8 caracteres')
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) {
      const ya = /already|registered|exists/i.test(error?.message ?? '')
      return fallo(ya ? 'Ya existe una cuenta con ese correo' : `No se pudo crear la cuenta: ${error?.message ?? 'error'}`)
    }
    const { error: errPerfil } = await admin.from('perfiles').insert({ id: data.user.id, nombre, email, rol: 'enfermera', activo: true })
    if (errPerfil) {
      await admin.auth.admin.deleteUser(data.user.id)
      return fallo(`No se pudo crear el perfil: ${errPerfil.message}`)
    }
    return responder({ ok: true, id: data.user.id })
  }

  // Las demás acciones apuntan a una cuenta existente.
  const id = texto(cuerpo.id)
  if (!id) return fallo('Falta la cuenta')
  const { data: perfil } = await admin.from('perfiles').select('id, rol').eq('id', id).maybeSingle()
  if (!perfil) return fallo('La cuenta no existe', 404)

  if (accion === 'activar') {
    const activo = cuerpo.activo === true
    if (!activo && (id === yo || perfil.rol === 'admin')) {
      return fallo('La cuenta admin no se puede desactivar. Primero traspasa el rol.')
    }
    const { error } = await admin.from('perfiles').update({ activo }).eq('id', id)
    if (error) return fallo(error.message)
    // Además se bloquea (o desbloquea) el inicio de sesión.
    const { error: errBan } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? 'none' : '876000h' })
    if (errBan) return fallo(errBan.message)
    return responder({ ok: true })
  }

  if (accion === 'clave') {
    const password = typeof cuerpo.password === 'string' ? cuerpo.password : ''
    if (password.length < 8) return fallo('La contraseña debe tener al menos 8 caracteres')
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return fallo(error.message)
    return responder({ ok: true })
  }

  if (accion === 'nombre') {
    const nombre = texto(cuerpo.nombre)
    if (!nombre) return fallo('Falta el nombre')
    const { error } = await admin.from('perfiles').update({ nombre }).eq('id', id)
    if (error) return fallo(error.message)
    return responder({ ok: true })
  }

  return fallo('Acción desconocida')
})
