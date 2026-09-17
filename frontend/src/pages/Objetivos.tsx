import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Indicador, Objetivo } from '../tipos'

const ESTADOS = ['En curso', 'Cumplido', 'En riesgo', 'Pausado']
const COLOR_ESTADO: Record<string, string> = {
  'En curso': 'bg-sky-100 text-sky-700',
  Cumplido: 'bg-emerald-100 text-emerald-700',
  'En riesgo': 'bg-rose-100 text-rose-700',
  Pausado: 'bg-slate-100 text-slate-600',
}

const VACIO = {
  titulo: '',
  detalle: '',
  responsable: '',
  indicador: 'manual',
  unidad: '',
  valor_inicial: null as number | null,
  valor_meta: null as number | null,
  valor_actual: null as number | null,
  vence: '' as string,
  estado: 'En curso',
}

export default function Objetivos() {
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [indicadores, setIndicadores] = useState<Indicador[]>([])
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)
  const [avanceDe, setAvanceDe] = useState<number | null>(null)
  const [avance, setAvance] = useState({ valor: '' as string, comentario: '' })

  async function cargar() {
    const [o, i] = await Promise.all([api<Objetivo[]>('/api/objetivos'), api<Indicador[]>('/api/indicadores')])
    setObjetivos(o)
    setIndicadores(i)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardar() {
    const cuerpo = JSON.stringify({ ...form, vence: form.vence || null })
    if (editando === 'nuevo') await api('/api/objetivos', { method: 'POST', body: cuerpo })
    else await api(`/api/objetivos/${editando}`, { method: 'PUT', body: cuerpo })
    setEditando(null)
    cargar()
  }

  async function borrar() {
    if (editando === 'nuevo' || editando === null) return
    await api(`/api/objetivos/${editando}`, { method: 'DELETE' })
    setEditando(null)
    cargar()
  }

  async function guardarAvance() {
    await api(`/api/objetivos/${avanceDe}/seguimientos`, {
      method: 'POST',
      body: JSON.stringify({ valor: avance.valor ? Number(avance.valor) : null, comentario: avance.comentario }),
    })
    setAvanceDe(null)
    setAvance({ valor: '', comentario: '' })
    cargar()
  }

  function abrir(o: Objetivo) {
    setForm({
      titulo: o.titulo,
      detalle: o.detalle,
      responsable: o.responsable,
      indicador: o.indicador,
      unidad: o.unidad,
      valor_inicial: o.valor_inicial,
      valor_meta: o.valor_meta,
      valor_actual: o.valor_actual,
      vence: o.vence ?? '',
      estado: o.estado,
    })
    setEditando(o.id)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-marca-800">Objetivos de gestión</h2>
          <p className="text-sm text-slate-500">{objetivos.length} objetivos · el avance se puede medir solo</p>
        </div>
        <button
          className="boton"
          onClick={() => {
            setForm(VACIO)
            setEditando('nuevo')
          }}
        >
          + Objetivo
        </button>
      </div>

      {objetivos.length === 0 && (
        <p className="text-sm text-slate-400">
          Todavía no hay objetivos. Elegí uno de los indicadores de abajo y ponele una meta.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {objetivos.map((o) => (
          <div key={o.id} className="tarjeta p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <button className="text-left" onClick={() => abrir(o)}>
                <p className="font-medium text-marca-800">{o.titulo}</p>
                {o.detalle && <p className="text-sm text-slate-500">{o.detalle}</p>}
              </button>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ESTADO[o.estado] ?? ''}`}>
                {o.estado}
              </span>
            </div>

            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-slate-500">
                {o.valor_inicial ?? '—'} → <strong className="text-marca-800">{o.valor_actual ?? '—'}</strong> de{' '}
                {o.valor_meta ?? '—'} {o.unidad}
              </span>
              {o.automatico && <span className="text-xs text-emerald-600">se mide solo</span>}
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-marca-600" style={{ width: `${o.avance ?? 0}%` }} />
            </div>
            <p className="text-xs text-slate-400">
              {o.avance !== null ? `${o.avance}% del camino` : 'sin meta cargada'}
              {o.responsable && ` · ${o.responsable}`}
              {o.vence && ` · para el ${o.vence}`}
            </p>

            {o.tareas.length > 0 && (
              <p className="text-xs text-slate-500">
                {o.tareas.filter((t) => t.estado === 'Hecha').length} de {o.tareas.length} tareas hechas
              </p>
            )}

            {o.seguimientos.length > 0 && (
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 space-y-0.5">
                {o.seguimientos.slice(0, 3).map((s) => (
                  <p key={s.id}>
                    <span className="text-slate-400">{s.fecha}</span> {s.valor ?? ''} {s.comentario}
                  </p>
                ))}
              </div>
            )}

            <button className="text-sm text-marca-700 hover:underline" onClick={() => setAvanceDe(o.id)}>
              + Anotar avance
            </button>
          </div>
        ))}
      </div>

      <div className="tarjeta p-4">
        <h3 className="font-medium text-marca-800">Indicadores que ya se miden solos</h3>
        <p className="text-sm text-slate-500 mb-3">Podés usar cualquiera como meta de un objetivo.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {indicadores
            .filter((i) => i.clave !== 'manual')
            .map((i) => (
              <div key={i.clave} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-slate-600">{i.texto}</span>
                <span className="font-semibold text-marca-800">{i.valor ?? '—'}</span>
              </div>
            ))}
        </div>
      </div>

      {avanceDe !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setAvanceDe(null)}>
          <div className="tarjeta w-full max-w-md p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-marca-800">Anotar avance</h3>
            <input
              className="campo"
              type="number"
              placeholder="Valor de hoy (opcional)"
              value={avance.valor}
              onChange={(e) => setAvance({ ...avance, valor: e.target.value })}
            />
            <textarea
              className="campo"
              rows={3}
              placeholder="Qué pasó desde la última vez"
              value={avance.comentario}
              onChange={(e) => setAvance({ ...avance, comentario: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button className="boton-suave" onClick={() => setAvanceDe(null)}>
                Cancelar
              </button>
              <button className="boton" onClick={guardarAvance}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div
            className="tarjeta w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-semibold text-marca-800">
              {editando === 'nuevo' ? 'Nuevo objetivo' : 'Editar objetivo'}
            </h3>
            <input
              className="campo"
              placeholder="Objetivo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
            <textarea
              className="campo"
              rows={2}
              placeholder="Detalle"
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            />
            <label className="text-sm text-slate-500">
              Cómo se mide
              <select
                className="campo"
                value={form.indicador}
                onChange={(e) => setForm({ ...form, indicador: e.target.value })}
              >
                {indicadores.map((i) => (
                  <option key={i.clave} value={i.clave}>
                    {i.texto}
                    {i.valor !== null ? ` (hoy: ${i.valor})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-500">
                Punto de partida
                <input
                  className="campo"
                  type="number"
                  value={form.valor_inicial ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, valor_inicial: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </label>
              <label className="text-sm text-slate-500">
                Meta
                <input
                  className="campo"
                  type="number"
                  value={form.valor_meta ?? ''}
                  onChange={(e) => setForm({ ...form, valor_meta: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
              {form.indicador === 'manual' && (
                <label className="text-sm text-slate-500">
                  Valor de hoy
                  <input
                    className="campo"
                    type="number"
                    value={form.valor_actual ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, valor_actual: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </label>
              )}
              <input
                className="campo"
                placeholder="Unidad (%, alumnos…)"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              />
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
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                {ESTADOS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>
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
