import { useEffect, useMemo, useState } from 'react'
import { api, DIAS } from '../api'
import type { Espacio, Taller } from '../tipos'

const ESTADOS = ['Con cupo', 'Lleno', 'Cerrado', 'Nuevo', 'No se da', 'Sin dato']

const COLOR_ESTADO: Record<string, string> = {
  'Con cupo': 'bg-emerald-100 text-emerald-800',
  Lleno: 'bg-amber-100 text-amber-800',
  Cerrado: 'bg-red-100 text-red-800',
  Nuevo: 'bg-marca-100 text-marca-800',
  'No se da': 'bg-slate-200 text-slate-500',
  'Sin dato': 'bg-slate-100 text-slate-500',
}

function Detalle({ id, espacios, onCerrar, onGuardado }: { id: number; espacios: Espacio[]; onCerrar: () => void; onGuardado: () => void }) {
  const [t, setT] = useState<(Taller & { alumnos: any[] }) | null>(null)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    api<Taller & { alumnos: any[] }>(`/api/talleres/${id}`).then((d) => {
      setT(d)
      setForm({
        nombre: d.nombre, area: d.area, dia: d.dia, desde: d.desde, hasta: d.hasta, turno: d.turno,
        espacio_id: d.espacio_id, docente_id: d.docente_id, docente_texto: d.docente_texto, estado: d.estado,
        cupo_max: d.cupo_max, observacion: d.observacion, difusion: d.difusion, activo: d.activo,
      })
    })
  }, [id])

  async function guardar() {
    await api(`/api/talleres/${id}`, { method: 'PUT', body: JSON.stringify({ ...form, cupo_max: form.cupo_max || null }) })
    setEditando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4 overflow-auto" onClick={onCerrar}>
      <div className="tarjeta w-full max-w-2xl p-5 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
        {!t && <p className="text-slate-500">Cargando…</p>}
        {t && form && (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-marca-800">{t.nombre}</h3>
                <p className="text-sm text-slate-500">
                  {t.dia_nombre} {t.desde}–{t.hasta} · {t.espacio?.nombre ?? 'sin aula'} · {t.docente || 'sin docente'}
                </p>
              </div>
              <button className="boton-suave" onClick={() => setEditando(!editando)}>
                {editando ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {editando ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="campo sm:col-span-2" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <select className="campo" value={form.dia} onChange={(e) => setForm({ ...form, dia: Number(e.target.value) })}>
                  {DIAS.slice(0, 6).map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
                <select
                  className="campo"
                  value={form.espacio_id ?? ''}
                  onChange={(e) => setForm({ ...form, espacio_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Sin aula</option>
                  {espacios.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
                <input className="campo" type="time" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
                <input className="campo" type="time" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
                <select className="campo" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
                <input
                  className="campo"
                  type="number"
                  placeholder="Cupo máximo"
                  value={form.cupo_max ?? ''}
                  onChange={(e) => setForm({ ...form, cupo_max: e.target.value ? Number(e.target.value) : null })}
                />
                <textarea
                  className="campo sm:col-span-2"
                  rows={2}
                  placeholder="Observación"
                  value={form.observacion}
                  onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                />
                <div className="sm:col-span-2 flex justify-end">
                  <button className="boton" onClick={guardar}>Guardar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`etiqueta ${COLOR_ESTADO[t.estado] ?? ''}`}>{t.estado}</span>
                <span className="etiqueta bg-slate-100 text-slate-600">
                  {t.inscriptos} inscriptos{t.cupo_max ? ` / cupo ${t.cupo_max}` : ' · sin cupo cargado'}
                </span>
                {t.area && <span className="etiqueta bg-slate-100 text-slate-600">{t.area}</span>}
                {t.observacion && <span className="text-slate-500">{t.observacion}</span>}
              </div>
            )}

            {t.difusion && <p className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3">{t.difusion}</p>}

            <div>
              <p className="font-medium text-marca-800 mb-2">Alumnos ({t.alumnos.length})</p>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {t.alumnos.map((a) => (
                  <div key={a.inscripcion_id} className="px-3 py-2 text-sm flex gap-3">
                    <span className="flex-1 truncate">{a.nombre}</span>
                    <span className="text-slate-400 truncate w-28 hidden sm:block">{a.dni || 'sin DNI'}</span>
                    <span className={`etiqueta ${a.estado_pago === 'Al día' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {a.estado_pago}
                    </span>
                  </div>
                ))}
                {t.alumnos.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Sin inscriptos cargados.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Talleres() {
  const [talleres, setTalleres] = useState<Taller[]>([])
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [q, setQ] = useState('')
  const [dia, setDia] = useState<number | ''>('')
  const [abierto, setAbierto] = useState<number | null>(null)

  async function cargar() {
    const [t, e] = await Promise.all([api<Taller[]>('/api/talleres'), api<Espacio[]>('/api/espacios')])
    setTalleres(t)
    setEspacios(e)
  }

  useEffect(() => {
    cargar()
  }, [])

  const lista = useMemo(
    () =>
      talleres.filter(
        (t) =>
          (dia === '' || t.dia === dia) &&
          (!q ||
            t.nombre.toLowerCase().includes(q.toLowerCase()) ||
            (t.docente || '').toLowerCase().includes(q.toLowerCase())),
      ),
    [talleres, q, dia],
  )

  return (
    <div className="space-y-4">
      <div className="tarjeta p-4 flex flex-wrap gap-3 items-center">
        <input className="campo flex-1 min-w-[12rem]" placeholder="Buscar taller o docente" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="campo w-auto" value={dia} onChange={(e) => setDia(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Todos los días</option>
          {DIAS.slice(0, 6).map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{lista.length} talleres</span>
      </div>

      <div className="tarjeta overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Taller</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Docente</th>
              <th className="text-left px-3 py-2 font-medium">Día y hora</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Aula</th>
              <th className="text-right px-3 py-2 font-medium">Inscriptos</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setAbierto(t.id)}>
                <td className="px-3 py-2">{t.nombre}</td>
                <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">{t.docente}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {t.dia_nombre} {t.desde}
                </td>
                <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">{t.espacio?.nombre ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {t.inscriptos}
                  {t.cupo_max ? <span className="text-slate-400">/{t.cupo_max}</span> : null}
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className={`etiqueta ${COLOR_ESTADO[t.estado] ?? ''}`}>{t.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {abierto !== null && (
        <Detalle
          id={abierto}
          espacios={espacios}
          onCerrar={() => setAbierto(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}
