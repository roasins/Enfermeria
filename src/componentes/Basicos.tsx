import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { CODIGO_PENDIENTE } from '../lib/tipos'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <LoaderCircle className="size-5 animate-spin" /> {texto}
    </div>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
      <p className="font-semibold text-slate-700">{titulo}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function ErrorCaja({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{children}</p>
}

/** Código SAP, o la marca "CÓDIGO PENDIENTE". */
export function Codigo({ codigo, className = '' }: { codigo: string | null; className?: string }) {
  if (!codigo || codigo === CODIGO_PENDIENTE) return <span className={`pendiente ${className}`}>{CODIGO_PENDIENTE}</span>
  return <span className={`codigo text-slate-600 ${className}`}>{codigo}</span>
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {accion}
    </div>
  )
}
