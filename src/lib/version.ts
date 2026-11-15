import { useCallback, useEffect, useState } from 'react'

/** Versión instalada en este dispositivo (fecha y hora de la compilación, UTC). */
export const VERSION = __VERSION__

/** Pregunta al servidor cuál es la versión publicada. null = no se pudo saber. */
async function versionPublicada(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json())?.version
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}

/** Trae la versión nueva: actualiza el service worker, borra los archivos guardados y recarga. */
export async function actualizarApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registros.map((r) => r.update().catch(() => {})))
    }
    if ('caches' in window) {
      const claves = await caches.keys()
      await Promise.all(claves.map((c) => caches.delete(c)))
    }
  } finally {
    window.location.reload()
  }
}

/**
 * Revisa si hay una versión nueva: al abrir, al volver a la app y cada 15 minutos.
 * `revisar` permite buscar a mano y devuelve si encontró una.
 */
export function useActualizacion() {
  const [hayNueva, setHayNueva] = useState(false)

  const revisar = useCallback(async (): Promise<boolean | null> => {
    if (import.meta.env.DEV) return false
    const publicada = await versionPublicada()
    if (publicada === null) return null
    const nueva = publicada !== VERSION
    setHayNueva(nueva)
    return nueva
  }, [])

  useEffect(() => {
    void revisar()
    const alVolver = () => document.visibilityState === 'visible' && void revisar()
    document.addEventListener('visibilitychange', alVolver)
    const reloj = setInterval(() => void revisar(), 15 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(reloj)
    }
  }, [revisar])

  return { hayNueva, revisar }
}
