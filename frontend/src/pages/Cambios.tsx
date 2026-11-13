import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Cambio } from '../tipos'

type Respuesta = { cambios: Cambio[]; usuarios: string[]; secciones: string[] }

export default function Cambios() {
  const [r, setR] = useState<Respuesta | null>(null)
  const [usuario, setUsuario] = useState('')
  const [seccion, setSeccion] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    const q = new URLSearchParams()
    if (usuario) q.set('usuario_filtro', usuario)
    if (seccion) q.set('seccion', seccion)
    api<Respuesta>(`/api/cambios?${q}`).then(setR)
  }, [usuario, seccion])

  if (!r) return <p className="text-slate-500">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-marca-800 flex-1">Registro de cambios</h2>
        <select className="campo w-auto" value={usuario} onChange={(e) => setUsuario(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {r.usuarios.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select className="campo w-auto" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
          <option value="">Todas las secciones</option>
          {r.secciones.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {r.cambios.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cambios registrados.</p>}

      <div className="tarjeta divide-y">
        {r.cambios.map((c) => (
          <div key={c.id} className="p-3 text-sm cursor-pointer hover:bg-slate-50" onClick={() => setAbierto(abierto === c.id ? null : c.id)}>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="tabular-nums text-slate-500 w-36">{c.fecha}</span>
              <span className="font-medium text-marca-800">{c.usuario}</span>
              <span className="text-slate-600">{c.accion}</span>
              <span className="rounded bg-slate-100 px-2 text-slate-600">{c.seccion}</span>
            </div>
            {abierto === c.id && c.detalle && (
              <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs text-slate-600">{c.detalle}</pre>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">Se muestran los últimos 300 movimientos. Clic en una fila para ver el detalle de lo que se cargó.</p>
    </div>
  )
}
