import { createClient } from '@supabase/supabase-js'

// Claves por variables de entorno (ver .env.example). Solo el proyecto Supabase de enfermería.
const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')
const clave = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '').trim()

/** Qué está mal en la configuración (null = todo bien). Se muestra en pantalla para poder corregirlo. */
export const problemaConfig: string | null = !url
  ? 'Falta la variable VITE_SUPABASE_URL.'
  : !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)
    ? `VITE_SUPABASE_URL no es una dirección de proyecto válida. Valor actual: "${url}". Debe ser como https://abcdefgh.supabase.co`
    : !clave
      ? 'Falta la variable VITE_SUPABASE_PUBLISHABLE_KEY.'
      : /^sb_secret_|service_role/i.test(clave)
        ? 'VITE_SUPABASE_PUBLISHABLE_KEY tiene una clave secreta. Debe ser la clave pública (sb_publishable_…).'
        : null

export const configurado = problemaConfig === null
/** Dirección del proyecto, para mostrarla en mensajes de error de conexión. */
export const urlProyecto = url
export const supabase = createClient(configurado ? url : 'https://sin-configurar.invalid', configurado ? clave : 'sin-configurar')
