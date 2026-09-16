import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Espacio } from '../tipos'

const VACIO = { nombre: '', ubicacion: '', capacidad: null as number | null, uso: 'Taller', activo: true }

export default function Espacios() {
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)

  async function cargar() {
    setEspacios(await api<Espacio[]>('/api/espacios'))
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardar() {
    const cuerpo = JSON.stringify({ ...form, capacidad: form.capacidad || null })
    if (editando === 'nuevo') await api('/api/espacios', { method: 'POST', body: cuerpo })
    else await api(`/api/espacios/${editando}`, { method: 'PUT', body: cuerpo })
    setEditando(null)
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-marca-800">Espacios ({espacios.length})</h2>
        <button
          className="boton"
          onClick={() => {
            setForm(VACIO)
            setEditando('nuevo')
          }}
        >
          + Espacio
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {espacios.map((e) => (
          <button
            key={e.id}
            className="tarjeta p-4 text-left hover:border-marca-600/40"
            onClick={() => {
              setForm({ nombre: e.nombre, ubicacion: e.ubicacion, capacidad: e.capacidad, uso: e.uso, activo: e.activo })
              setEditando(e.id)
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium text-marca-800">{e.nombre}</p>
              <span className="text-sm text-slate-500">{e.capacidad ? `${e.capacidad} lugares` : 'sin cupo'}</span>
            </div>
            <p className="text-sm text-slate-500">{e.ubicacion || '—'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {e.uso} · {e.clases_semana ?? 0} clases por semana{e.activo ? '' : ' · inactivo'}
            </p>
          </button>
        ))}
      </div>

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div className="tarjeta w-full max-w-md p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-marca-800">{editando === 'nuevo' ? 'Nuevo espacio' : 'Editar espacio'}</h3>
            <input className="campo" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input className="campo" placeholder="Ubicación" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="campo"
                type="number"
                placeholder="Capacidad"
                value={form.capacidad ?? ''}
                onChange={(e) => setForm({ ...form, capacidad: e.target.value ? Number(e.target.value) : null })}
              />
              <select className="campo" value={form.uso} onChange={(e) => setForm({ ...form, uso: e.target.value })}>
                {['Taller', 'Reuniones', 'Actividades y eventos', 'Gestión'].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              Activo (aparece en la agenda)
            </label>
            <div className="flex justify-end gap-2">
              <button className="boton-suave" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="boton" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
