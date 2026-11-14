import { KeyRound, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Cargando, ErrorCaja, Titulo } from '../componentes/Basicos'
import { Hoja } from '../componentes/Hoja'
import { useAvisos } from '../contexto/Avisos'
import { useSesion } from '../contexto/Sesion'
import { mensajeError } from '../lib/formato'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'
import { accionUsuaria, leerPerfiles } from '../lib/usuarias'

type Dialogo = { tipo: 'crear' } | { tipo: 'opciones' | 'clave' | 'traspasar'; usuaria: Perfil }

export function Usuarias() {
  const { perfil, recargarPerfil } = useSesion()
  const { avisar, fallar } = useAvisos()
  const [lista, setLista] = useState<Perfil[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setLista(await leerPerfiles())
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  /** Ejecuta una acción, avisa y recarga la lista. */
  const hacer = async (accion: () => Promise<void>, listo: string) => {
    setOcupado(true)
    try {
      await accion()
      avisar(listo)
      setDialogo(null)
      await cargar()
    } catch (e) {
      fallar(e)
    } finally {
      setOcupado(false)
    }
  }

  const traspasar = (u: Perfil) =>
    hacer(async () => {
      const { error } = await supabase.rpc('traspasar_admin', { nueva_admin: u.id })
      if (error) throw error
      await recargarPerfil() // esta cuenta deja de ser admin: la app la saca de esta pantalla
    }, `${u.nombre} es la nueva administradora`)

  if (error) return <ErrorCaja>{error}</ErrorCaja>
  if (!lista) return <Cargando />

  return (
    <>
      <Titulo
        accion={
          <button type="button" className="btn-primario btn-chico" onClick={() => setDialogo({ tipo: 'crear' })}>
            <Plus className="size-4" /> Nueva
          </button>
        }
      >
        Usuarias
      </Titulo>
      <ul className="tarjeta divide-y divide-slate-100 overflow-hidden">
        {lista.map((u) => {
          const yo = u.id === perfil!.id
          return (
            <li key={u.id}>
              <button type="button" disabled={yo} onClick={() => setDialogo({ tipo: 'opciones', usuaria: u })} className="flex w-full items-center gap-3 px-4 py-3 text-left enabled:active:bg-slate-100">
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${u.activo ? '' : 'text-slate-400'}`}>
                    {u.nombre} {yo && <span className="font-normal text-slate-500">(tú)</span>}
                  </span>
                  <span className="block truncate text-sm text-slate-500">{u.email}</span>
                </span>
                {u.rol === 'admin' ? (
                  <span className="shrink-0 rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">Admin</span>
                ) : !u.activo ? (
                  <span className="shrink-0 rounded-lg bg-slate-200 px-2 py-1 text-xs font-bold text-slate-600">Desactivada</span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-slate-500">Enfermera</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-sm text-slate-500">Toca una cuenta para desactivarla, cambiarle la contraseña o traspasarle el rol de administradora.</p>

      {dialogo?.tipo === 'crear' && <CrearUsuaria ocupado={ocupado} onCerrar={() => setDialogo(null)} onCrear={(d) => hacer(() => accionUsuaria({ accion: 'crear', ...d }), 'Cuenta creada')} />}

      {dialogo?.tipo === 'opciones' && (
        <Hoja titulo={dialogo.usuaria.nombre} onCerrar={() => setDialogo(null)}>
          <div className="grid gap-2">
            <button type="button" className="btn-claro justify-start" onClick={() => setDialogo({ tipo: 'clave', usuaria: dialogo.usuaria })}>
              <KeyRound className="size-5" /> Cambiar contraseña
            </button>
            {dialogo.usuaria.activo ? (
              <button type="button" className="btn-peligro justify-start" disabled={ocupado} onClick={() => hacer(() => accionUsuaria({ accion: 'activar', id: dialogo.usuaria.id, activo: false }), 'Cuenta desactivada')}>
                <UserRoundX className="size-5" /> Desactivar cuenta
              </button>
            ) : (
              <button type="button" className="btn-claro justify-start" disabled={ocupado} onClick={() => hacer(() => accionUsuaria({ accion: 'activar', id: dialogo.usuaria.id, activo: true }), 'Cuenta activada')}>
                <UserRoundCheck className="size-5" /> Volver a activar
              </button>
            )}
            {dialogo.usuaria.activo && (
              <button type="button" className="btn-claro justify-start" onClick={() => setDialogo({ tipo: 'traspasar', usuaria: dialogo.usuaria })}>
                <ShieldCheck className="size-5" /> Traspasar rol de administradora
              </button>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-500">Una cuenta desactivada no puede entrar, pero sus pedidos se conservan.</p>
        </Hoja>
      )}

      {dialogo?.tipo === 'clave' && <CambiarClave usuaria={dialogo.usuaria} ocupado={ocupado} onCerrar={() => setDialogo(null)} onGuardar={(password) => hacer(() => accionUsuaria({ accion: 'clave', id: dialogo.usuaria.id, password }), 'Contraseña cambiada')} />}

      {dialogo?.tipo === 'traspasar' && (
        <Hoja titulo="Traspasar rol de administradora" onCerrar={() => !ocupado && setDialogo(null)}>
          <p className="text-slate-600">
            <strong className="text-slate-900">{dialogo.usuaria.nombre}</strong> pasará a ser la única administradora. Tú quedarás como enfermera y ya no podrás editar el catálogo ni las cuentas.
          </p>
          <div className="mt-5 flex gap-2">
            <button type="button" className="btn-claro flex-1" onClick={() => setDialogo(null)} disabled={ocupado}>
              Cancelar
            </button>
            <button type="button" className="btn-peligro flex-1" onClick={() => traspasar(dialogo.usuaria)} disabled={ocupado}>
              {ocupado ? 'Traspasando…' : 'Sí, traspasar'}
            </button>
          </div>
        </Hoja>
      )}
    </>
  )
}

function CrearUsuaria({ ocupado, onCerrar, onCrear }: { ocupado: boolean; onCerrar: () => void; onCrear: (d: { nombre: string; email: string; password: string }) => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    onCrear({ nombre: nombre.trim(), email: email.trim(), password })
  }
  return (
    <Hoja titulo="Nueva enfermera" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="u-nombre">
            Nombre y apellido
          </label>
          <input id="u-nombre" className="campo" autoComplete="off" required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <p className="mt-1 text-sm text-slate-500">Así aparecerá en el Excel del pedido.</p>
        </div>
        <div>
          <label className="etiqueta" htmlFor="u-email">
            Correo
          </label>
          <input id="u-email" className="campo" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="u-clave">
            Contraseña inicial
          </label>
          <input id="u-clave" className="campo" type="text" autoComplete="off" autoCapitalize="none" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-sm text-slate-500">Mínimo 8 caracteres. Entrégasela en persona; ella puede cambiarla después en "Mi cuenta".</p>
        </div>
        <button className="btn-primario w-full" disabled={ocupado}>
          {ocupado ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </Hoja>
  )
}

function CambiarClave({ usuaria, ocupado, onCerrar, onGuardar }: { usuaria: Perfil; ocupado: boolean; onCerrar: () => void; onGuardar: (password: string) => void }) {
  const [password, setPassword] = useState('')
  return (
    <Hoja titulo={`Nueva contraseña para ${usuaria.nombre}`} onCerrar={onCerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onGuardar(password)
        }}
        className="space-y-4"
      >
        <div>
          <label className="etiqueta" htmlFor="c-clave">
            Contraseña nueva
          </label>
          <input id="c-clave" className="campo" type="text" autoComplete="off" autoCapitalize="none" autoFocus required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-sm text-slate-500">Mínimo 8 caracteres.</p>
        </div>
        <button className="btn-primario w-full" disabled={ocupado}>
          {ocupado ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </Hoja>
  )
}
