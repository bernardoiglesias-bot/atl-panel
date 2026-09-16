import { useEffect, useMemo, useState } from 'react'
import { api, fechaLarga, hoyISO, sumarDias } from '../api'
import type { Agenda as AgendaTipo, Espacio, Evento, ItemAgenda } from '../tipos'

const INICIO = 8 * 60
const FIN = 22 * 60
const PASO = 30
const FILAS = (FIN - INICIO) / PASO

const COLOR: Record<string, string> = {
  clase: 'bg-marca-50 border-marca-600/40 text-marca-800',
  evento: 'bg-amber-50 border-amber-500/50 text-amber-900',
  suspendida: 'bg-slate-100 border-slate-300 text-slate-400 line-through',
}

function minutos(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function FormularioEvento({
  espacios,
  fecha,
  evento,
  onCerrar,
  onGuardado,
}: {
  espacios: Espacio[]
  fecha: string
  evento: Evento | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [datos, setDatos] = useState({
    titulo: evento?.titulo ?? '',
    tipo: evento?.tipo ?? 'Reunión',
    fecha: evento?.fecha ?? fecha,
    desde: evento?.desde ?? '09:00',
    hasta: evento?.hasta ?? '10:00',
    espacio_id: evento?.espacio_id ?? null,
    responsable: evento?.responsable ?? '',
    notas: evento?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const ruta = evento ? `/api/eventos/${evento.id}` : '/api/eventos'
    await api(ruta, { method: evento ? 'PUT' : 'POST', body: JSON.stringify(datos) })
    setGuardando(false)
    onGuardado()
  }

  async function borrar() {
    if (!evento || !confirm('¿Borrar esta actividad de la agenda?')) return
    await api(`/api/eventos/${evento.id}`, { method: 'DELETE' })
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={onCerrar}>
      <form className="tarjeta w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3 className="font-semibold text-marca-800">{evento ? 'Editar actividad' : 'Nueva actividad en la agenda'}</h3>
        <input
          className="campo"
          placeholder="Título (reunión de coordinación, arreglo del horno…)"
          required
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <select className="campo" value={datos.tipo} onChange={(e) => setDatos({ ...datos, tipo: e.target.value })}>
            {['Reunión', 'Mantenimiento', 'Gestión', 'Evento', 'Feriado', 'Suspensión'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="campo"
            type="date"
            value={datos.fecha}
            onChange={(e) => setDatos({ ...datos, fecha: e.target.value })}
          />
          <input
            className="campo"
            type="time"
            value={datos.desde}
            onChange={(e) => setDatos({ ...datos, desde: e.target.value })}
          />
          <input
            className="campo"
            type="time"
            value={datos.hasta}
            onChange={(e) => setDatos({ ...datos, hasta: e.target.value })}
          />
        </div>
        <select
          className="campo"
          value={datos.espacio_id ?? ''}
          onChange={(e) => setDatos({ ...datos, espacio_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Sin espacio asignado</option>
          {espacios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <input
          className="campo"
          placeholder="Responsable"
          value={datos.responsable}
          onChange={(e) => setDatos({ ...datos, responsable: e.target.value })}
        />
        <textarea
          className="campo"
          placeholder="Notas"
          rows={2}
          value={datos.notas}
          onChange={(e) => setDatos({ ...datos, notas: e.target.value })}
        />
        <div className="flex gap-2 justify-end pt-1">
          {evento && (
            <button type="button" className="boton-suave text-red-600" onClick={borrar}>
              Borrar
            </button>
          )}
          <button type="button" className="boton-suave" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton" disabled={guardando}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}

function PanelClase({
  item,
  fecha,
  espacios,
  onCerrar,
  onGuardado,
}: {
  item: ItemAgenda
  fecha: string
  espacios: Espacio[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [espacioId, setEspacioId] = useState<number | null>(item.espacio?.id ?? null)
  const [motivo, setMotivo] = useState(item.motivo || '')

  async function guardar(suspendida: boolean) {
    await api('/api/excepciones', {
      method: 'POST',
      body: JSON.stringify({ taller_id: item.id, fecha, suspendida, espacio_id: espacioId, motivo }),
    })
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={onCerrar}>
      <div className="tarjeta w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-marca-800">{item.titulo}</h3>
          <p className="text-sm text-slate-500">
            {item.desde}–{item.hasta} · {item.detalle || 'sin docente'} · {item.inscriptos ?? 0} inscriptos
          </p>
        </div>
        <p className="text-xs text-slate-500">Cambio sólo para el {fechaLarga(fecha)}:</p>
        <select
          className="campo"
          value={espacioId ?? ''}
          onChange={(e) => setEspacioId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Sin espacio</option>
          {espacios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <input className="campo" placeholder="Motivo del cambio" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button className="boton-suave text-red-600" onClick={() => guardar(true)}>
            Suspender esta clase
          </button>
          <button className="boton" onClick={() => guardar(false)}>
            Guardar cambio de aula
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Agenda() {
  const [fecha, setFecha] = useState(hoyISO())
  const [vista, setVista] = useState<'grilla' | 'lista'>('grilla')
  const [datos, setDatos] = useState<AgendaTipo | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [formEvento, setFormEvento] = useState<{ abierto: boolean; evento: Evento | null }>({ abierto: false, evento: null })
  const [claseAbierta, setClaseAbierta] = useState<ItemAgenda | null>(null)

  async function cargar() {
    const [agenda, evs] = await Promise.all([
      api<AgendaTipo>(`/api/agenda?fecha=${fecha}`),
      api<Evento[]>(`/api/eventos?desde=${fecha}&hasta=${fecha}`),
    ])
    setDatos(agenda)
    setEventos(evs)
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  const espaciosConUso = useMemo(() => {
    if (!datos) return []
    const usados = new Set(datos.items.map((i) => i.espacio?.id).filter(Boolean))
    return datos.espacios.filter((e) => usados.has(e.id) || e.uso === 'Taller')
  }, [datos])

  const sinEspacio = datos?.items.filter((i) => !i.espacio) ?? []

  return (
    <div className="space-y-4">
      <div className="tarjeta p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button className="boton-suave" onClick={() => setFecha(sumarDias(fecha, -1))}>
            ←
          </button>
          <input className="campo w-auto" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button className="boton-suave" onClick={() => setFecha(sumarDias(fecha, 1))}>
            →
          </button>
          <button className="boton-suave" onClick={() => setFecha(hoyISO())}>
            Hoy
          </button>
        </div>
        <p className="flex-1 font-medium text-marca-800 capitalize min-w-[14rem]">{fechaLarga(fecha)}</p>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden">
          {(['grilla', 'lista'] as const).map((v) => (
            <button
              key={v}
              className={`px-3 py-2 text-sm ${vista === v ? 'bg-marca-600 text-white' : 'bg-white text-slate-600'}`}
              onClick={() => setVista(v)}
            >
              {v === 'grilla' ? 'Grilla de espacios' : 'Lista cronológica'}
            </button>
          ))}
        </div>
        <button className="boton" onClick={() => setFormEvento({ abierto: true, evento: null })}>
          + Actividad
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const f = sumarDias(fecha, i - 3)
          return (
            <button
              key={f}
              onClick={() => setFecha(f)}
              className={`rounded-lg border px-3 py-1.5 ${f === fecha ? 'bg-marca-600 text-white border-marca-600' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
            </button>
          )
        })}
      </div>

      {!datos && <p className="text-slate-500">Cargando…</p>}

      {datos && datos.items.length === 0 && (
        <div className="tarjeta p-8 text-center text-slate-500">No hay nada agendado para este día.</div>
      )}

      {datos && vista === 'grilla' && datos.items.length > 0 && (
        <div className="tarjeta overflow-auto">
          <div className="min-w-[900px]">
            <div
              className="grid border-b border-slate-200 bg-slate-50 sticky top-0 z-10"
              style={{ gridTemplateColumns: `4rem repeat(${espaciosConUso.length}, minmax(9rem, 1fr))` }}
            >
              <div />
              {espaciosConUso.map((e) => (
                <div key={e.id} className="px-2 py-2 text-xs font-medium text-slate-600 border-l border-slate-200">
                  {e.nombre}
                  {e.capacidad ? <span className="text-slate-400"> · {e.capacidad}</span> : null}
                </div>
              ))}
            </div>
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `4rem repeat(${espaciosConUso.length}, minmax(9rem, 1fr))`,
                gridTemplateRows: `repeat(${FILAS}, 1.6rem)`,
              }}
            >
              {Array.from({ length: FILAS }).map((_, f) => (
                <div
                  key={`h${f}`}
                  className={`text-[11px] text-slate-400 px-2 border-t ${f % 2 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                  style={{ gridColumn: 1, gridRow: f + 1 }}
                >
                  {f % 2 === 0 ? `${String(Math.floor((INICIO + f * PASO) / 60)).padStart(2, '0')}:00` : ''}
                </div>
              ))}
              {espaciosConUso.map((_, c) =>
                Array.from({ length: FILAS }).map((_, f) => (
                  <div
                    key={`c${c}-${f}`}
                    className={`border-l border-slate-200 border-t ${f % 2 === 0 ? 'border-t-slate-200' : 'border-t-slate-100'}`}
                    style={{ gridColumn: c + 2, gridRow: f + 1 }}
                  />
                )),
              )}
              {datos.items
                .filter((i) => i.espacio)
                .map((i) => {
                  const col = espaciosConUso.findIndex((e) => e.id === i.espacio!.id)
                  if (col < 0) return null
                  const desde = Math.max(0, Math.round((minutos(i.desde) - INICIO) / PASO))
                  const hasta = Math.min(FILAS, Math.round((minutos(i.hasta) - INICIO) / PASO))
                  return (
                    <button
                      key={`${i.tipo}-${i.id}`}
                      onClick={() => (i.tipo === 'evento'
                        ? setFormEvento({ abierto: true, evento: eventos.find((e) => e.id === i.id) ?? null })
                        : setClaseAbierta(i))}
                      className={`m-0.5 rounded-lg border px-2 py-1 text-left text-[11px] leading-tight overflow-hidden ${COLOR[i.tipo]}`}
                      style={{ gridColumn: col + 2, gridRow: `${desde + 1} / ${Math.max(hasta, desde + 1) + 1}` }}
                    >
                      <span className="font-medium block truncate">{i.titulo}</span>
                      <span className="block truncate opacity-75">
                        {i.desde}–{i.hasta}
                      </span>
                      <span className="block truncate opacity-75">{i.detalle}</span>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {datos && vista === 'lista' && (
        <div className="tarjeta divide-y divide-slate-100">
          {datos.items.map((i) => (
            <button
              key={`${i.tipo}-${i.id}`}
              onClick={() => (i.tipo === 'evento'
                ? setFormEvento({ abierto: true, evento: eventos.find((e) => e.id === i.id) ?? null })
                : setClaseAbierta(i))}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-4 items-start"
            >
              <span className="w-24 shrink-0 text-sm tabular-nums text-slate-500">
                {i.desde}–{i.hasta}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-medium ${i.tipo === 'suspendida' ? 'line-through text-slate-400' : ''}`}>
                  {i.titulo}
                </span>
                <span className="block text-sm text-slate-500">
                  {i.detalle}
                  {i.tipo === 'clase' && i.inscriptos !== undefined ? ` · ${i.inscriptos} inscriptos` : ''}
                  {i.motivo ? ` · ${i.motivo}` : ''}
                </span>
              </span>
              <span className="text-sm text-slate-600 shrink-0">{i.espacio?.nombre ?? 'sin espacio'}</span>
              {i.tipo === 'evento' && <span className="etiqueta bg-amber-100 text-amber-800">{i.subtipo}</span>}
            </button>
          ))}
        </div>
      )}

      {vista === 'grilla' && sinEspacio.length > 0 && (
        <div className="tarjeta p-4">
          <p className="text-sm font-medium text-slate-600 mb-2">Sin espacio asignado</p>
          <div className="flex flex-wrap gap-2">
            {sinEspacio.map((i) => (
              <span key={`${i.tipo}-${i.id}`} className="etiqueta bg-slate-100 text-slate-600">
                {i.desde} · {i.titulo}
              </span>
            ))}
          </div>
        </div>
      )}

      {formEvento.abierto && datos && (
        <FormularioEvento
          espacios={datos.espacios}
          fecha={fecha}
          evento={formEvento.evento}
          onCerrar={() => setFormEvento({ abierto: false, evento: null })}
          onGuardado={() => {
            setFormEvento({ abierto: false, evento: null })
            cargar()
          }}
        />
      )}
      {claseAbierta && datos && (
        <PanelClase
          item={claseAbierta}
          fecha={fecha}
          espacios={datos.espacios}
          onCerrar={() => setClaseAbierta(null)}
          onGuardado={() => {
            setClaseAbierta(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
