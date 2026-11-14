import { LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ErrorCaja, Titulo } from '../componentes/Basicos'
import { useAvisos } from '../contexto/Avisos'
import { useSesion } from '../contexto/Sesion'
import { mensajeError } from '../lib/formato'
import { supabase } from '../lib/supabase'

export function Cuenta() {
  const { perfil, correo, esAdmin, salir } = useSesion()
  const { avisar } = useAvisos()
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiar = async (e: FormEvent) => {
    e.preventDefault()
    if (clave !== repetir) return setError('Las contraseñas no coinciden.')
    setGuardando(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setGuardando(false)
    if (error) return setError(/different from the old/i.test(error.message) ? 'La contraseña nueva debe ser distinta a la actual.' : mensajeError(error))
    setClave('')
    setRepetir('')
    avisar('Contraseña cambiada')
  }

  return (
    <>
      <Titulo>Mi cuenta</Titulo>
      <div className="tarjeta p-4">
        <p className="text-lg font-bold">{perfil!.nombre}</p>
        <p className="text-slate-600">{correo}</p>
        <p className="mt-2 inline-block rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">{esAdmin ? 'Administradora' : 'Enfermera'}</p>
      </div>

      <form onSubmit={cambiar} className="tarjeta mt-4 space-y-4 p-4">
        <h2 className="text-lg font-bold">Cambiar contraseña</h2>
        <div>
          <label className="etiqueta" htmlFor="n-clave">
            Contraseña nueva
          </label>
          <input id="n-clave" className="campo" type="password" autoComplete="new-password" required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="r-clave">
            Repetir contraseña
          </label>
          <input id="r-clave" className="campo" type="password" autoComplete="new-password" required minLength={8} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </div>
        {error && <ErrorCaja>{error}</ErrorCaja>}
        <button className="btn-claro w-full" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>

      <button type="button" className="btn-peligro mt-4 w-full" onClick={salir}>
        <LogOut className="size-5" /> Cerrar sesión
      </button>
    </>
  )
}
