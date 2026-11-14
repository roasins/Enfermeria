const ZONA = 'America/Santiago'
const fFecha = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })
const fLarga = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fHora = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })

/** 14-11-2026 */
export const fecha = (d: string | Date) => fFecha.format(new Date(d))
/** sábado, 14 de noviembre de 2026 */
export const fechaLarga = (d: string | Date) => fLarga.format(new Date(d))
export const hora = (d: string | Date) => fHora.format(new Date(d))

/** Mensaje legible a partir de un error de Supabase o de red. */
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.'
  return m
}
