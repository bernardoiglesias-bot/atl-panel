import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Docente, Feedback as Devolucion, Personal } from '../tipos'

const TIPOS = ['Seguimiento', 'Felicitación', 'Reclamo', 'Pedido', 'Entrevista']
const COLOR_TIPO: Record<string, string> = {
  Seguimiento: 'bg-sky-100 text-sky-700',
  Felicitación: 'bg-emerald-100 text-emerald-700',
  Reclamo: 'bg-rose-100 text-rose-700',
  Pedido: 'bg-amber-100 text-amber-700',
  Entrevista: 'bg-violet-100 text-violet-700',
}

const VACIO = {
  fecha: '' as string,
  persona: '' as string, // "d-12" docente, "p-3" personal
  tipo: 'Seguimiento',
  valoracion: null as number | null,
  tema: '',
  comentario: '',
  acuerdos: '',
}

export default function Feedback() {
  const [filas, setFilas] = useState<Devolucion[]>([])
  const [docentes, setDocentes] = useState<Docente[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)

  async function cargar() {
    const [f, d, p] = await Promise.all([
      api<Devolucion[]>('/api/feedback'),
      api<Docente[]>('/api/docentes'),
      api<Personal[]>('/api/personal'),
    ])
    setFilas(f)
    setDocentes(d)
    setPersonal(p)
  }

  useEffect(() => {
    cargar()
  }, [])

  function cuerpo() {
    const [clase, id] = form.persona.split('-')
    return JSON.stringify({
      fecha: form.fecha || null,
      docente_id: clase === 'd' ? Number(id) : null,
      personal_id: clase === 'p' ? Number(id) : null,
      persona_texto: '',
      tipo: form.tipo,
      valoracion: form.valoracion,
      tema: form.tema,
      comentario: form.comentario,
      acuerdos: form.acuerdos,
    })
  }

  async function guardar() {
    if (editando === 'nuevo') await api('/api/feedback', { method: 'POST', body: cuerpo() })
    else await api(`/api/feedback/${editando}`, { method: 'PUT', body: cuerpo() })
    setEditando(null)
    cargar()
  }

  async function borrar() {
    if (editando === 'nuevo' || editando === null) return
    await api(`/api/feedback/${editando}`, { method: 'DELETE' })
    setEditando(null)
    cargar()
  }

  function abrir(f: Devolucion) {
    setForm({
      fecha: f.fecha ?? '',
      persona: f.docente_id ? `d-${f.docente_id}` : f.personal_id ? `p-${f.personal_id}` : '',
      tipo: f.tipo,
      valoracion: f.valoracion,
      tema: f.tema,
      comentario: f.comentario,
      acuerdos: f.acuerdos,
    })
    setEditando(f.id)
  }

  const q = busca.trim().toLowerCase()
  const visibles = q
    ? filas.filter((f) => (f.persona + ' ' + f.tema + ' ' + f.comentario).toLowerCase().includes(q))
    : filas

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-marca-800">Feedback con docentes y personal</h2>
          <p className="text-sm text-slate-500">{filas.length} devoluciones registradas</p>
        </div>
        <button
          className="boton"
          onClick={() => {
            setForm(VACIO)
            setEditando('nuevo')
          }}
        >
          + Devolución
        </button>
      </div>

      <input
        className="campo"
        placeholder="Buscar por persona, tema o comentario"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {visibles.length === 0 && (
        <p className="text-sm text-slate-400">
          Todavía no hay devoluciones. Cargá una después de cada charla con un docente o con el personal.
        </p>
      )}

      <div className="space-y-3">
        {visibles.map((f) => (
          <button key={f.id} className="tarjeta p-4 w-full text-left hover:border-marca-600/40" onClick={() => abrir(f)}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-marca-800">
                {f.persona || 'Sin persona'}
                <span className="text-sm font-normal text-slate-400"> · {f.rol || 'sin rol'}</span>
              </p>
              <div className="flex items-center gap-2">
                {f.valoracion && <span className="text-sm text-amber-500">{'★'.repeat(f.valoracion)}</span>}
                <span className={`text-xs px-2 py-0.5 rounded-full ${COLOR_TIPO[f.tipo] ?? ''}`}>{f.tipo}</span>
                <span className="text-xs text-slate-400">{f.fecha}</span>
              </div>
            </div>
            {f.tema && <p className="text-sm font-medium text-slate-700 mt-1">{f.tema}</p>}
            {f.comentario && <p className="text-sm text-slate-500">{f.comentario}</p>}
            {f.acuerdos && <p className="text-sm text-marca-700 mt-1">Acuerdos: {f.acuerdos}</p>}
          </button>
        ))}
      </div>

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div
            className="tarjeta w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-semibold text-marca-800">
              {editando === 'nuevo' ? 'Nueva devolución' : 'Editar devolución'}
            </h3>
            <select
              className="campo"
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
            >
              <option value="">Elegir persona</option>
              <optgroup label="Docentes">
                {docentes.map((d) => (
                  <option key={`d-${d.id}`} value={`d-${d.id}`}>
                    {d.nombre}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Personal">
                {personal.map((p) => (
                  <option key={`p-${p.id}`} value={`p-${p.id}`}>
                    {p.nombre} — {p.funcion}
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="grid grid-cols-3 gap-3">
              <select className="campo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                className="campo"
                value={form.valoracion ?? ''}
                onChange={(e) => setForm({ ...form, valoracion: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Sin valoración</option>
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {'★'.repeat(v)}
                  </option>
                ))}
              </select>
              <input
                className="campo"
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <input
              className="campo"
              placeholder="Tema"
              value={form.tema}
              onChange={(e) => setForm({ ...form, tema: e.target.value })}
            />
            <textarea
              className="campo"
              rows={3}
              placeholder="Qué se habló"
              value={form.comentario}
              onChange={(e) => setForm({ ...form, comentario: e.target.value })}
            />
            <textarea
              className="campo"
              rows={2}
              placeholder="Acuerdos y compromisos"
              value={form.acuerdos}
              onChange={(e) => setForm({ ...form, acuerdos: e.target.value })}
            />
            <div className="flex justify-between">
              {editando !== 'nuevo' ? (
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
