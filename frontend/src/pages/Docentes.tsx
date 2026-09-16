import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Docente } from '../tipos'

type Personal = { id: number; nombre: string; funcion: string; email: string; telefono: string }

export default function Docentes() {
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    api<Docente[]>('/api/docentes').then(setDocentes)
    api<Personal[]>('/api/personal').then(setPersonal)
  }, [])

  const lista = useMemo(
    () => docentes.filter((d) => !q || d.nombre.toLowerCase().includes(q.toLowerCase())),
    [docentes, q],
  )

  return (
    <div className="space-y-4">
      <div className="tarjeta p-4 flex flex-wrap gap-3 items-center">
        <input className="campo flex-1 min-w-[12rem]" placeholder="Buscar docente" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-slate-500">{lista.length} docentes</span>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {lista.map((d) => (
          <div key={d.id} className="tarjeta p-4">
            <button className="w-full text-left" onClick={() => setAbierto(abierto === d.id ? null : d.id)}>
              <p className="font-medium text-marca-800">{d.nombre}</p>
              <p className="text-sm text-slate-500">
                {d.talleres.length} taller{d.talleres.length === 1 ? '' : 'es'} · {d.email || 'sin mail'}
              </p>
            </button>
            <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
              {d.talleres.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span className="w-32 shrink-0 text-slate-400">
                    {t.dia_nombre} {t.desde}
                  </span>
                  <span className="flex-1 truncate">{t.nombre}</span>
                  <span className="text-slate-400">{t.espacio}</span>
                </li>
              ))}
            </ul>
            {abierto === d.id && (
              <dl className="mt-3 border-t border-slate-100 pt-3 text-sm space-y-1">
                {[
                  ['DNI', d.dni],
                  ['Celular', d.celular],
                  ['Nacimiento', d.nacimiento],
                  ['Facturación', d.facturacion],
                  ['Cupo mínimo / máximo', [d.cupo_min, d.cupo_max].filter(Boolean).join(' / ')],
                  ['Necesidades técnicas', d.necesidades],
                  ['Estado de maquinaria', d.maquinaria],
                  ['Sugerencias', d.sugerencias],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k as string} className="flex gap-2">
                      <dt className="w-40 shrink-0 text-slate-400">{k}</dt>
                      <dd className="flex-1 text-slate-600">{v}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      <div className="tarjeta p-4">
        <h3 className="font-medium text-marca-800 mb-2">Personal del centro</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {personal.map((p) => (
            <div key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-700">{p.nombre}</p>
              <p className="text-slate-500">{p.funcion}</p>
              <p className="text-slate-400 truncate">{p.email}</p>
              <p className="text-slate-400">{p.telefono}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
