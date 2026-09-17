import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Espacio, Gasto, GastosResp } from '../tipos'

const ETAPAS = ['Necesidad', 'Presupuestado', 'Adelanto pedido', 'Adelanto recibido', 'Rendido', 'Rechazado']
const RUBROS = ['Materiales', 'Mantenimiento', 'Equipamiento', 'Difusión', 'Limpieza', 'Servicios', 'Otros']
const COLOR_ETAPA: Record<string, string> = {
  Necesidad: 'bg-slate-100 text-slate-600',
  Presupuestado: 'bg-sky-100 text-sky-700',
  'Adelanto pedido': 'bg-amber-100 text-amber-700',
  'Adelanto recibido': 'bg-violet-100 text-violet-700',
  Rendido: 'bg-emerald-100 text-emerald-700',
  Rechazado: 'bg-rose-100 text-rose-700',
}

const VACIO = {
  concepto: '',
  detalle: '',
  rubro: 'Materiales',
  etapa: 'Necesidad',
  monto_presupuestado: null as number | null,
  monto_adelanto: null as number | null,
  monto_rendido: null as number | null,
  proveedor: '',
  solicitante: '',
  espacio_id: null as number | null,
  fecha_necesidad: '' as string,
  notas: '',
}

function plata(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

export default function Gastos() {
  const [datos, setDatos] = useState<GastosResp | null>(null)
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)

  async function cargar() {
    const [g, e] = await Promise.all([api<GastosResp>('/api/gastos'), api<Espacio[]>('/api/espacios')])
    setDatos(g)
    setEspacios(e)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardar() {
    const cuerpo = JSON.stringify({ ...form, fecha_necesidad: form.fecha_necesidad || null })
    if (editando === 'nuevo') await api('/api/gastos', { method: 'POST', body: cuerpo })
    else await api(`/api/gastos/${editando}`, { method: 'PUT', body: cuerpo })
    setEditando(null)
    cargar()
  }

  async function borrar() {
    if (editando === 'nuevo' || editando === null) return
    await api(`/api/gastos/${editando}`, { method: 'DELETE' })
    setEditando(null)
    cargar()
  }

  function abrir(g: Gasto) {
    setForm({
      concepto: g.concepto,
      detalle: g.detalle,
      rubro: g.rubro || 'Materiales',
      etapa: g.etapa,
      monto_presupuestado: g.monto_presupuestado,
      monto_adelanto: g.monto_adelanto,
      monto_rendido: g.monto_rendido,
      proveedor: g.proveedor,
      solicitante: g.solicitante,
      espacio_id: g.espacio_id,
      fecha_necesidad: g.fecha_necesidad ?? '',
      notas: g.notas,
    })
    setEditando(g.id)
  }

  if (!datos) return <p className="text-slate-500">Cargando…</p>

  const lista = filtro ? datos.gastos.filter((g) => g.etapa === filtro) : datos.gastos

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-marca-800">Gastos y presupuesto</h2>
          <p className="text-sm text-slate-500">Necesidad → presupuesto → adelanto → rendición</p>
        </div>
        <button
          className="boton"
          onClick={() => {
            setForm(VACIO)
            setEditando('nuevo')
          }}
        >
          + Gasto
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Presupuestado', datos.totales.presupuestado],
          ['Adelantos recibidos', datos.totales.adelantado],
          ['Rendido', datos.totales.rendido],
          ['Falta rendir', datos.totales.pendiente_rendir],
        ].map(([texto, valor]) => (
          <div key={texto as string} className="tarjeta p-4">
            <p className="text-sm text-slate-500">{texto}</p>
            <p className="text-xl font-semibold text-marca-800">{plata(valor as number)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`text-sm px-3 py-1 rounded-full ${filtro === '' ? 'bg-marca-700 text-white' : 'bg-slate-100 text-slate-600'}`}
          onClick={() => setFiltro('')}
        >
          Todos ({datos.gastos.length})
        </button>
        {ETAPAS.map((e) => (
          <button
            key={e}
            className={`text-sm px-3 py-1 rounded-full ${filtro === e ? 'bg-marca-700 text-white' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setFiltro(e)}
          >
            {e} ({datos.por_etapa[e] ?? 0})
          </button>
        ))}
      </div>

      {lista.length === 0 && <p className="text-sm text-slate-400">Todavía no hay gastos cargados.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {lista.map((g) => (
          <button key={g.id} className="tarjeta p-4 text-left hover:border-marca-600/40" onClick={() => abrir(g)}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-marca-800">{g.concepto}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_ETAPA[g.etapa] ?? ''}`}>
                {g.etapa}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {g.rubro || 'sin rubro'}
              {g.espacio && ` · ${g.espacio}`}
              {g.proveedor && ` · ${g.proveedor}`}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-400">Presupuesto</p>
                <p>{plata(g.monto_presupuestado)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Adelanto</p>
                <p>{plata(g.monto_adelanto)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Rendido</p>
                <p>{plata(g.monto_rendido)}</p>
              </div>
            </div>
            {g.pendiente_rendir > 0 && (
              <p className="text-xs text-amber-700 mt-1">Falta rendir {plata(g.pendiente_rendir)}</p>
            )}
          </button>
        ))}
      </div>

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div
            className="tarjeta w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-semibold text-marca-800">{editando === 'nuevo' ? 'Nuevo gasto' : 'Editar gasto'}</h3>
            <input
              className="campo"
              placeholder="Concepto"
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            />
            <textarea
              className="campo"
              rows={2}
              placeholder="Detalle"
              value={form.detalle}
              onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <select className="campo" value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value })}>
                {RUBROS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select className="campo" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                {ETAPAS.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['monto_presupuestado', 'Presupuesto'],
                  ['monto_adelanto', 'Adelanto'],
                  ['monto_rendido', 'Rendido'],
                ] as const
              ).map(([campo, texto]) => (
                <label key={campo} className="text-sm text-slate-500">
                  {texto}
                  <input
                    className="campo"
                    type="number"
                    value={form[campo] ?? ''}
                    onChange={(e) => setForm({ ...form, [campo]: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="campo"
                placeholder="Proveedor"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
              <input
                className="campo"
                placeholder="Solicitante"
                value={form.solicitante}
                onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
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
              <label className="text-sm text-slate-500">
                Se necesita para
                <input
                  className="campo"
                  type="date"
                  value={form.fecha_necesidad}
                  onChange={(e) => setForm({ ...form, fecha_necesidad: e.target.value })}
                />
              </label>
            </div>
            <textarea
              className="campo"
              rows={2}
              placeholder="Notas de la rendición"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
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
