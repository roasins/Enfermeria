import { createClient } from '@supabase/supabase-js'

// Claves por variables de entorno (ver .env.example). Solo el proyecto Supabase de enfermería.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const configurado = Boolean(url && clave)
export const supabase = createClient(url || 'https://sin-configurar.invalid', clave || 'sin-configurar')
