import { Navigate, Route, Routes } from 'react-router'
import { Cargando } from './componentes/Basicos'
import { Marco } from './componentes/Marco'
import { BorradorProvider } from './contexto/Borrador'
import { CatalogoProvider } from './contexto/Catalogo'
import { useSesion } from './contexto/Sesion'
import { configurado } from './lib/supabase'
import { Catalogo } from './paginas/Catalogo'
import { Cuenta } from './paginas/Cuenta'
import { DetallePedido } from './paginas/DetallePedido'
import { Estadisticas } from './paginas/Estadisticas'
import { Historial } from './paginas/Historial'
import { Login } from './paginas/Login'
import { ModoSap } from './paginas/ModoSap'
import { NuevoPedido } from './paginas/NuevoPedido'
import { PedidoEnCurso } from './paginas/PedidoEnCurso'
import { Usuarias } from './paginas/Usuarias'

function Mensaje({ titulo, texto, accion }: { titulo: string; texto: string; accion?: { nombre: string; hacer: () => void } }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 text-center">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="mt-2 text-slate-600">{texto}</p>
      {accion && (
        <button type="button" className="btn-claro mt-6" onClick={accion.hacer}>
          {accion.nombre}
        </button>
      )}
    </div>
  )
}

export function App() {
  const sesion = useSesion()

  if (!configurado) {
    return <Mensaje titulo="Falta configurar la app" texto="Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (ver DEPLOY.md) y vuelve a publicar." />
  }
  if (sesion.cargando) return <Cargando />
  if (!sesion.usuarioId) return <Login />
  if (!sesion.perfil) {
    return <Mensaje titulo="No pudimos abrir tu cuenta" texto={sesion.problema ?? ''} accion={{ nombre: 'Cerrar sesión', hacer: sesion.salir }} />
  }

  return (
    <CatalogoProvider>
      <BorradorProvider key={sesion.perfil.id}>
        <Marco>
          <Routes>
            <Route path="/" element={<NuevoPedido />} />
            <Route path="/pedido" element={<PedidoEnCurso />} />
            <Route path="/historial" element={<Historial />} />
            <Route path="/historial/:id" element={<DetallePedido />} />
            <Route path="/sap/:id" element={<ModoSap />} />
            <Route path="/estadisticas" element={<Estadisticas />} />
            <Route path="/cuenta" element={<Cuenta />} />
            {sesion.esAdmin && <Route path="/catalogo" element={<Catalogo />} />}
            {sesion.esAdmin && <Route path="/usuarias" element={<Usuarias />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Marco>
      </BorradorProvider>
    </CatalogoProvider>
  )
}
