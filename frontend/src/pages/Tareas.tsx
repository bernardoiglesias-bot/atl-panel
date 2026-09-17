import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Espacio, Objetivo, Tarea } from '../tipos'

const PLAZOS = ['Urgente', 'Corto', 'Mediano', 'Largo']
const ESTADOS = ['Pendiente', 'En curso', 'Hecha']
const TEXTO_PLAZO: Record<string, string> = {
  Urgente: 'Urgencias',
  Corto: 'Corto plazo',
  Mediano: 'Mediano plazo',
  Largo: 'Largo plazo',
}
const COLOR_PLAZO: Record<string, string> = {
  Urgente: 'bg-rose-100 text-rose-700',
  Corto: 'bg-amber-100 text-amber-700',
  Mediano: 'bg-sky-100 text-sky-700',
  Largo: 'bg-slate-100 text-slate-600',
}

const VACIA = {
  titulo: '',
  detalle: '',
  plazo: 'Corto',
  estado: 'Pendiente',
  responsable: '',
  area: '',
  espacio_id: null as number | null,
  vence: '' as string,
  objetivo_id: null as number | null,
}

export default function Tareas() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [verHechas, setVerHechas] = useState(false)
  const [editando, setEditando] = useState<number | 'nueva' | null>(null)
  const [form, setForm] = useState(VACIA)

  async function cargar() {
    const [t, e, o] = await Promise.all([
      api<Tarea[]>('/api/tareas'),
      api<Espacio[]>('/api/espacios'),
      api<Objetivo[]>('/api/objetivos'),
    ])
    setTareas(t)
    setEspacios(e)
    setObjetivos(o)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardar() {
    const cuerpo = JSON.stringify({ ...form, vence: form.vence || null })
    if (editando === 'nueva') await api('/api/tareas', { method: 'POST', body: cuerpo })
    else await api(`/api/tareas/${editando}`, { method: 'PUT', body: cuerpo })
    setEditando(null)
    cargar()
  }

  async function borrar() {
    if (editando === 'nueva' || editando === null) return
    await api(`/api/tareas/${editando}`, { method: 'DELETE' })
    setEditando(null)
    cargar()
  }

  async function cambiarEstado(t: Tarea, estado: string) {
    await api(`/api/tareas/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...t, estado, vence: t.vence || null }),
    })
    cargar()
  }

  function abrir(t: Tarea) {
    setForm({
      titulo: t.titulo,
      detalle: t.detalle,
      plazo: t.plazo,
      estado: t.estado,
      responsable: t.responsable,
      area: t.area,
      espacio_id: t.espacio_id,
      vence: t.vence ?? '',
      objetivo_id: t.objetivo_id,
    })
    setEditando(t.id)
  }

  const visibles = tareas.filter((t) => verHechas || t.estado !== 'Hecha')
  const pendientes = tareas.filter((t) => t.estado !== 'Hecha')
  const vencidas = pendientes.filter((t) => t.vencida)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-marca-800">Tareas por hacer</h2>
          <p className="text-sm text-slate-500">
            {pendientes.length} pendientes
            {vencidas.length > 0 && <span className="text-rose-600"> · {vencidas.length} con la fecha pasada</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} />
            Ver las hechas
          </label>
          <button
            className="boton"
            onClick={() => {
              setForm(VACIA)
              setEditando('nueva')
            }}
          >
            + Tarea
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {PLAZOS.map((plazo) => {
          const lista = visibles.filter((t) => t.plazo === plazo)
          return (
            <div key={plazo} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-marca-800">{TEXTO_PLAZO[plazo]}</h3>
                <span className="text-sm text-slate-400">{lista.length}</span>
              </div>
              {lista.length === 0 && <p className="text-sm text-slate-400">Sin tareas.</p>}
              {lista.map((t) => (
                <div key={t.id} className={`tarjeta p-3 space-y-2 ${t.estado === 'Hecha' ? 'opacity-60' : ''}`}>
                  <button className="text-left w-full" onClick={() => abrir(t)}>
                    <p className="font-medium text-marca-800">{t.titulo}</p>
                    {t.detalle && <p className="text-sm text-slate-500 line-clamp-2">{t.detalle}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {t.responsable || 'sin responsable'}
                      {t.espacio && ` · ${t.espacio}`}
                      {t.objetivo && ` · ${t.objetivo}`}
                    </p>
                    {t.vence && (
                      <p className={`text-xs mt-0.5 ${t.vencida ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                        {t.vencida ? 'Venció el ' : 'Para el '}
                        {t.vence}
                      </p>
                    )}
                  </button>
                  <div className="flex gap-1">
                    {ESTADOS.map((e) => (
                      <button
                        key={e}
                        onClick={() => cambiarEstado(t, e)}
                        className={`text-xs px-2 py-1 rounded ${
                          t.estado === e ? COLOR_PLAZO[plazo] + ' font-medium' : 'text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div className="tarjeta w-full max-w-lg p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-marca-800">{editando === 'nueva' ? 'Nueva tarea' : 'Editar tarea'}</h3>
            <input
              className="campo"
              placeholder="Qué hay que hacer"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
            <textarea
              className="campo"
              rows={3}
              placeholder="Detalle"
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <select className="campo" value={form.plazo} onChange={(e) => setForm({ ...form, plazo: e.target.value })}>
                {PLAZOS.map((p) => (
                  <option key={p} value={p}>
                    {TEXTO_PLAZO[p]}
                  </option>
                ))}
              </select>
              <select
                className="campo"
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                {ESTADOS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <input
                className="campo"
                placeholder="Responsable"
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              />
              <input
                className="campo"
                type="date"
                value={form.vence}
                onChange={(e) => setForm({ ...form, vence: e.target.value })}
              />
              <select
                className="campo"
                value={form.espacio_id ?? ''}
                onChange={(e) => setForm({ ...form, espacio_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Sin espacio</option>
                {espacios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <select
                className="campo"
                value={form.objetivo_id ?? ''}
                onChange={(e) => setForm({ ...form, objetivo_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Sin objetivo</option>
                {objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between">
              {editando !== 'nueva' ? (
                <button className="text-sm text-rose-600 hover:underline" onClick={borrar}>
                  Borrar
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button className="boton-suave" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
                <button className="boton" onClick={guardar}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
