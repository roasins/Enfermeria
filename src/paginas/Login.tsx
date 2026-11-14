import { ClipboardPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ErrorCaja } from '../componentes/Basicos'
import { mensajeError } from '../lib/formato'
import { supabase, urlProyecto } from '../lib/supabase'

export function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    if (error) {
      const m = error.message
      setError(
        /invalid login credentials/i.test(m)
          ? 'Correo o contraseña incorrectos.'
          : /banned/i.test(m)
            ? 'Tu cuenta está desactivada. Habla con la administradora.'
            : /Failed to fetch|NetworkError|Load failed/i.test(m)
              ? `No se pudo conectar con ${urlProyecto}. Si tu internet funciona, esa dirección de Supabase está mal escrita en la configuración.`
              : mensajeError(error),
      )
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-teal-700 text-white shadow-md">
          <ClipboardPlus className="size-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos de insumos</h1>
        <p className="mt-1 text-slate-600">Enfermería</p>
      </div>
      <form onSubmit={entrar} className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="correo">
            Correo
          </label>
          <input id="correo" className="campo" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="clave">
            Contraseña
          </label>
          <input id="clave" className="campo" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">¿No tienes cuenta u olvidaste tu contraseña? Pídesela a la administradora.</p>
    </div>
  )
}
