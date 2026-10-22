import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Espacio, Taller } from '../tipos'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const FRANJAS = [
  ['09:00', '10:50'],
  ['11:00', '12:50'],
  ['15:00', '16:50'],
  ['17:00', '18:50'],
  ['19:00', '20:50'],
]
const FRANJAS_SABADO = [['09:00', '11:50']]
const PERIODO_2026 = '1C2026'
const PERIODO_2027 = '2027'
const ESTADOS_2027 = ['Tentativo', 'Confirmado', 'A confirmar docente', 'Nuevo', 'No sigue']

const PB = `"a6 a6 esc esc a7 a7" "b1 b1 esc esc a7 a7" "ph ph ph ph ph ph" "a4 a4 pv b2 a3 a8" "a4 a4 pv a2 a2 a8" "buf buf pv a2 a2 a8" "a5 adm pv a1 a1 a8" "a5 adm ing a1 a1 a8"`
const PA = `"ter ter ter" "a11 gal a10" "a11 gal b3" "a11 gal a9" "bal bal a9"`

type Conflicto = { tipo: 'espacio' | 'docente'; dia: string; detalle: string; talleres: Taller[] }

function minutos(h: string) {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + (b || 0)
}

function enFranja(c: Taller, [desde, hasta]: string[]) {
  return minutos(c.desde) < minutos(hasta) && minutos(c.hasta) > minutos(desde)
}

function colorEstado(estado: string) {
  if (estado === 'Lleno') return 'border-l-red-500'
  if (estado === 'Cerrado' || estado === 'No se da' || estado === 'No sigue') return 'border-l-slate-300 text-slate-400'
  if (estado === 'Nuevo') return 'border-l-sky-400'
  if (estado === 'Tentativo' || estado === 'A confirmar docente') return 'border-l-amber-400'
  if (estado === 'Confirmado') return 'border-l-green-500'
  return 'border-l-marca-600/60'
}

function Aula({
  num,
  clases,
  franjas,
  editable,
  conflictivos,
  onEditar,
  onNuevo,
}: {
  num: number
  clases: Taller[]
  franjas: string[][]
  editable: boolean
  conflictivos: Set<number>
  onEditar: (t: Taller) => void
  onNuevo: (aula: number, desde: string, hasta: string) => void
}) {
  return (
    <div className="tarjeta p-2 min-w-0" style={{ gridArea: `a${num}` }}>
      <div className="text-lg font-bold text-slate-400 leading-none mb-1">{num}</div>
      <ul className="space-y-1.5">
        {franjas.map((f) => {
          const empiezan = clases.filter((c) => minutos(c.desde) >= minutos(f[0]) && minutos(c.desde) < minutos(f[1]))
          const ocupada = clases.some((c) => enFranja(c, f))
          if (empiezan.length === 0 && ocupada) return null
          if (empiezan.length === 0)
            return (
              <li key={f[0]} className="border-l-[3px] border-l-slate-200 pl-1.5 text-xs leading-tight text-slate-400">
                <span className="tabular-nums">{f[0]}–{f[1]}</span> · LIBRE
                {editable && (
                  <button className="ml-1 text-marca-700 hover:underline" onClick={() => onNuevo(num, f[0], f[1])}>
                    + agregar
                  </button>
                )}
              </li>
            )
          return empiezan.map((c) => (
            <li
              key={c.id}
              className={`border-l-[3px] pl-1.5 text-xs leading-tight ${colorEstado(c.estado)} ${
                conflictivos.has(c.id) ? 'bg-red-50 rounded-r' : ''
              } ${editable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={editable ? () => onEditar(c) : undefined}
            >
              <div className="font-semibold tabular-nums">
                {c.desde}–{c.hasta}
              </div>
              <div className="text-slate-800">{c.nombre}</div>
              <div className="text-slate-500">
                {c.docente}
                {!editable && <> · {c.inscriptos ?? 0} insc.</>}
                {c.estado !== 'Con cupo' && c.estado !== 'Sin dato' && <b> · {c.estado}</b>}
              </div>
            </li>
          ))
        })}
      </ul>
    </div>
  )
}

function Fijo({ area, texto, vertical = false, pasto = false }: { area: string; texto: string; vertical?: boolean; pasto?: boolean }) {
  return (
    <div
      className={`rounded-lg border text-xs font-medium grid place-items-center p-1 text-center ${
        pasto ? 'border-green-300 bg-green-100 text-green-800' : 'border-slate-200 bg-slate-100 text-slate-500'
      }`}
      style={{
        gridArea: area,
        writingMode: vertical ? 'vertical-rl' : undefined,
        backgroundImage: pasto
          ? 'repeating-linear-gradient(115deg, transparent 0 6px, rgba(22,163,74,.18) 6px 7px), repeating-linear-gradient(65deg, transparent 0 9px, rgba(22,163,74,.14) 9px 10px)'
          : undefined,
      }}
    >
      {texto}
    </div>
  )
}

type Form = {
  nombre: string
  docente_texto: string
  dia: number
  desde: string
  hasta: string
  espacio_id: number | null
  estado: string
  observacion: string
}

function Formulario2027({
  taller,
  inicial,
  espacios,
  onCerrar,
  onGuardado,
}: {
  taller: Taller | null
  inicial: Form
  espacios: Espacio[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [f, setF] = useState<Form>(inicial)
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const body = {
      ...f,
      periodo: PERIODO_2027,
      area: taller?.area ?? '',
      turno: minutos(f.desde) < 13 * 60 ? 'Mañana' : 'Tarde',
      docente_id: taller?.docente_id ?? null,
      cupo_max: taller?.cupo_max ?? null,
      difusion: taller?.difusion ?? '',
      activo: true,
    }
    await api(taller ? `/api/talleres/${taller.id}` : '/api/talleres', {
      method: taller ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    })
    setGuardando(false)
    onGuardado()
  }

  async function borrar() {
    if (!taller || !confirm('¿Sacar este taller de la planificación 2027?')) return
    await api(`/api/talleres/${taller.id}`, { method: 'DELETE' })
    onGuardado()
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={onCerrar}>
      <form className="tarjeta w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3 className="font-semibold text-marca-800">{taller ? 'Editar taller 2027' : 'Nuevo taller 2027'}</h3>
        <input className="campo" placeholder="Nombre del taller" required value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <input className="campo" placeholder="Docente" value={f.docente_texto} onChange={(e) => setF({ ...f, docente_texto: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <select className="campo" value={f.dia} onChange={(e) => setF({ ...f, dia: Number(e.target.value) })}>
            {DIAS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input className="campo" type="time" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          <input className="campo" type="time" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select className="campo" value={f.espacio_id ?? ''} onChange={(e) => setF({ ...f, espacio_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Sin aula</option>
            {espacios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <select className="campo" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            {ESTADOS_2027.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea className="campo" rows={2} placeholder="Observaciones" value={f.observacion} onChange={(e) => setF({ ...f, observacion: e.target.value })} />
        <div className="flex justify-between gap-2 pt-1">
          {taller ? (
            <button type="button" className="boton-suave text-red-700" onClick={borrar}>
              Sacar de 2027
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="boton-suave" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="boton" disabled={guardando}>
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function Plano() {
  const [periodo, setPeriodo] = useState(PERIODO_2026)
  const [talleres, setTalleres] = useState<Taller[]>([])
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [conflictos, setConflictos] = useState<Conflicto[]>([])
  const [dia, setDia] = useState(0)
  const [form, setForm] = useState<{ taller: Taller | null; inicial: Form } | null>(null)
  const es2027 = periodo === PERIODO_2027

  const cargar = useCallback(async () => {
    const [t, e] = await Promise.all([api<Taller[]>(`/api/talleres?periodo=${periodo}`), api<Espacio[]>('/api/espacios')])
    setTalleres(t)
    setEspacios(e)
    setConflictos(periodo === PERIODO_2027 ? await api<Conflicto[]>(`/api/planificacion/${PERIODO_2027}/conflictos`) : [])
  }, [periodo])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function copiar() {
    if (!confirm('¿Crear la planificación 2027 copiando la grilla 2026 actual (mismas aulas y horarios)?')) return
    await api(`/api/planificacion/${PERIODO_2027}/copiar`, { method: 'POST' })
    cargar()
  }

  const porAula = useMemo(() => {
    const m: Record<number, Taller[]> = {}
    for (const t of talleres) {
      if (t.dia !== dia || !t.activo) continue
      const num = Number((t.espacio?.nombre ?? '').replace(/\D/g, ''))
      if (!num) continue
      ;(m[num] ??= []).push(t)
    }
    for (const k in m) m[k].sort((a, b) => a.desde.localeCompare(b.desde))
    return m
  }, [talleres, dia])

  const franjas = dia === 5 ? FRANJAS_SABADO : FRANJAS
  const sinAula = talleres.filter((t) => t.dia === dia && t.activo && !/\d/.test(t.espacio?.nombre ?? ''))
  const total = talleres.filter((t) => t.dia === dia && t.activo).length
  const conflictivos = useMemo(() => new Set(conflictos.flatMap((c) => c.talleres.map((t) => t.id))), [conflictos])
  const conflictosDia = conflictos.filter((c) => c.dia === DIAS[dia])

  function abrirEditar(t: Taller) {
    setForm({
      taller: t,
      inicial: {
        nombre: t.nombre,
        docente_texto: t.docente || t.docente_texto,
        dia: t.dia,
        desde: t.desde,
        hasta: t.hasta,
        espacio_id: t.espacio_id,
        estado: t.estado,
        observacion: t.observacion,
      },
    })
  }

  function abrirNuevo(aula: number, desde: string, hasta: string) {
    const esp = espacios.find((e) => e.nombre === `Aula ${aula}`)
    setForm({
      taller: null,
      inicial: { nombre: '', docente_texto: '', dia, desde, hasta, espacio_id: esp?.id ?? null, estado: 'Tentativo', observacion: '' },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marca-800">Plano por día</h1>
          <p className="text-sm text-slate-500">
            {es2027
              ? 'Planificación tentativa 2027. Tocá un taller para cambiarlo, o "+ agregar" en una franja libre. Fondo rojo: choque de aula o docente.'
              : 'Franjas por aula (9, 11, 15, 17 y 19 hs; sábados 9 a 11:50); LIBRE donde no hay actividad. Rojo: lleno · gris: cerrado · celeste: nuevo.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {[
              [PERIODO_2026, '2026'],
              [PERIODO_2027, '2027'],
            ].map(([p, texto]) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-sm font-semibold ${periodo === p ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'}`}
              >
                {texto}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {DIAS.map((d, i) => (
              <button
                key={d}
                onClick={() => setDia(i)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  i === dia ? 'bg-marca-700 text-white border-marca-700' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {es2027 && talleres.length === 0 && (
        <div className="tarjeta p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">La planificación 2027 todavía está vacía.</p>
          <button className="boton" onClick={copiar}>
            Copiar la grilla 2026 como base
          </button>
        </div>
      )}

      <p className="text-sm text-slate-600">
        <b>{DIAS[dia]}</b> · {total} clases
        {sinAula.length > 0 && <> · {sinAula.length} sin aula: {sinAula.map((t) => t.nombre).join(', ')}</>}
        {es2027 && <> · {conflictos.length} choques en la semana</>}
      </p>

      {es2027 && conflictosDia.length > 0 && (
        <div className="tarjeta p-3 border-red-200 bg-red-50 text-sm space-y-1">
          <b className="text-red-800">Choques del {DIAS[dia].toLowerCase()}</b>
          {conflictosDia.map((c, i) => (
            <div key={i} className="text-red-900">
              {c.tipo === 'espacio' ? 'Misma aula' : 'Mismo docente'} ({c.detalle}): {c.talleres[0].nombre} {c.talleres[0].desde}–{c.talleres[0].hasta} y{' '}
              {c.talleres[1].nombre} {c.talleres[1].desde}–{c.talleres[1].hasta}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        <section>
          <h2 className="font-semibold text-slate-500 mb-2">Planta baja</h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateAreas: PB, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridAutoRows: 'minmax(56px, auto)' }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Aula key={n} num={n} clases={porAula[n] ?? []} franjas={franjas} editable={es2027} conflictivos={conflictivos} onEditar={abrirEditar} onNuevo={abrirNuevo} />
            ))}
            <Fijo area="esc" texto="Patio" pasto />
            <Fijo area="b1" texto="Baño" />
            <Fijo area="b2" texto="Baño" />
            <Fijo area="ph" texto="Pasillo" />
            <Fijo area="pv" texto="Pasillo" vertical />
            <Fijo area="buf" texto="Buffet" />
            <Fijo area="adm" texto="Administración" />
            <Fijo area="ing" texto="▲ Ingreso" />
          </div>
        </section>
        <section>
          <h2 className="font-semibold text-slate-500 mb-2">Planta alta</h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateAreas: PA, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: 'minmax(56px, auto)' }}
          >
            {[9, 10, 11].map((n) => (
              <Aula key={n} num={n} clases={porAula[n] ?? []} franjas={franjas} editable={es2027} conflictivos={conflictivos} onEditar={abrirEditar} onNuevo={abrirNuevo} />
            ))}
            <Fijo area="ter" texto="Terraza" />
            <Fijo area="gal" texto="Galería" vertical />
            <Fijo area="b3" texto="Baño" />
            <Fijo area="bal" texto="Balcón" />
          </div>
        </section>
      </div>

      {form && (
        <Formulario2027
          taller={form.taller}
          inicial={form.inicial}
          espacios={espacios.filter((e) => /^Aula \d+$/.test(e.nombre))}
          onCerrar={() => setForm(null)}
          onGuardado={() => {
            setForm(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
