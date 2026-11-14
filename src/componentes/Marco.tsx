import { BarChart3, ClipboardList, History, Package, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useBorrador } from '../contexto/Borrador'
import { useSesion } from '../contexto/Sesion'

/** Marco de las pantallas privadas: barra superior y navegación inferior. */
export function Marco({ children }: { children: ReactNode }) {
  const { perfil, esAdmin } = useSesion()
  const { items } = useBorrador()

  const enlaces = [
    { a: '/', nombre: 'Pedir', icono: ClipboardList, cuenta: items.length },
    { a: '/historial', nombre: 'Historial', icono: History },
    { a: '/estadisticas', nombre: 'Estadísticas', icono: BarChart3 },
    ...(esAdmin
      ? [
          { a: '/catalogo', nombre: 'Catálogo', icono: Package },
          { a: '/usuarias', nombre: 'Usuarias', icono: Users },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-teal-700 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 text-white">
        <Link to="/" className="text-base font-bold tracking-tight">
          Pedidos de insumos
        </Link>
        <Link to="/cuenta" className="flex max-w-[55%] items-center gap-1.5 rounded-full bg-white/15 py-1.5 pr-3 pl-2 text-sm font-medium">
          <UserRound className="size-4 shrink-0" />
          <span className="truncate">{perfil?.nombre}</span>
        </Link>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          {enlaces.map(({ a, nombre, icono: Icono, cuenta }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-teal-700' : 'text-slate-500'}`
              }
            >
              <span className="relative">
                <Icono className="size-6" />
                {cuenta ? (
                  <span className="absolute -top-1.5 -right-3 min-w-5 rounded-full bg-teal-700 px-1 text-center text-[11px] leading-5 font-bold text-white">{cuenta}</span>
                ) : null}
              </span>
              {nombre}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
