import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Docente } from '../tipos'

type Personal = { id: number; nombre: string; funcion: string; email: string; telefono: string }

const CAMPOS: [keyof FormDocente, string, boolean][] = [
  ['nombre', 'Nombre y apellido', false],
  ['dni', 'DNI', false],
  ['email', 'Mail', false],
  ['celular', 'Celular', false],
  ['nacimiento', 'Fecha de nacimiento', false],
  ['facturacion', 'Facturación', false],
  ['cupo_min', 'Cupo mínimo', false],
  ['cupo_max', 'Cupo máximo', false],
  ['necesidades', 'Necesidades técnicas', true],
  ['maquinaria', 'Estado de maquinaria', true],
  ['sugerencias', 'Sugerencias', true],
]
type FormDocente = Omit<Docente, 'id' | 'talleres'>
const VACIO: FormDocente = {
  nombre: '', dni: '', email: '', celular: '', nacimiento: '', facturacion: '',
  necesidades: '', maquinaria: '', sugerencias: '', cupo_min: '', cupo_max: '',
}

function FormularioDocente({ docente, onCerrar, onGuardado }: { docente: Docente | null; onCerrar: () => void; onGuardado: () => void }) {
  const [f, setF] = useState<FormDocente>(() => (docente ? { ...VACIO, ...docente } : VACIO))
  const [guardando, setGuardando] = useState(false)
  async function guardar() {
    if (!f.nombre.trim()) return
    setGuardando(true)
    try {
      const body = JSON.stringify(f)
      if (docente) await api(`/api/docentes/${docente.id}`, { method: 'PUT', body })
      else await api('/api/docentes', { method: 'POST', body })
      onGuardado()
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onCerrar}>
      <div className="tarjeta w-full max-w-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-medium text-marca-800">{docente ? 'Editar docente' : 'Nuevo docente'}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {CAMPOS.map(([k, etiqueta, largo]) => (
            <label key={k} className={`text-sm ${largo ? 'sm:col-span-2' : ''}`}>
              <span className="text-slate-500">{etiqueta}</span>
              {largo ? (
                <textarea className="campo mt-1" rows={2} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              ) : (
                <input className="campo mt-1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button className="boton-suave" onClick={onCerrar}>Cancelar</button>
          <button className="boton" disabled={guardando || !f.nombre.trim()} onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function Docentes() {
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)
  const [editando, setEditando] = useState<Docente | null | 'nuevo'>(null)

  function cargar() {
    api<Docente[]>('/api/docentes').then(setDocentes)
  }
  useEffect(() => {
    cargar()
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
        <button className="boton" onClick={() => setEditando('nuevo')}>+ Nuevo docente</button>
      </div>
      {editando !== null && (
        <FormularioDocente
          docente={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }}
        />
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {lista.map((d) => (
          <div key={d.id} className="tarjeta p-4">
            <button className="w-full text-left" onClick={() => setAbierto(abierto === d.id ? null : d.id)}>
              <p className="font-medium text-marca-800">{d.nombre}</p>
              <p className="text-sm text-slate-500">
                {d.talleres.filter((t) => t.activo).length} taller{d.talleres.filter((t) => t.activo).length === 1 ? '' : 'es'} · {d.email || 'sin mail'}
              </p>
            </button>
            <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
              {d.talleres.map((t) => (
                <li key={t.id} className={`flex gap-2 ${t.activo ? '' : 'text-slate-400 line-through'}`}>
                  <span className="w-32 shrink-0 text-slate-400">
                    {t.dia_nombre} {t.desde}
                  </span>
                  <span className="flex-1 truncate">{t.nombre}</span>
                  {!t.activo && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 text-xs text-slate-500 no-underline">Dado de baja</span>
                  )}
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
                <div className="pt-2">
                  <button className="boton-suave" onClick={() => setEditando(d)}>Editar datos</button>
                </div>
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
