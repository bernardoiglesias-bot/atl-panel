import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Taller } from '../tipos'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const FRANJAS = [
  ['09:00', '10:50'],
  ['11:00', '12:50'],
  ['15:00', '16:50'],
  ['17:00', '18:50'],
  ['19:00', '20:50'],
]

function minutos(h: string) {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + (b || 0)
}

const FRANJAS_SABADO = [['09:00', '11:50']]

function enFranja(c: Taller, [desde, hasta]: string[]) {
  return minutos(c.desde) < minutos(hasta) && minutos(c.hasta) > minutos(desde)
}

const PB = `"a6 a6 esc esc a7 a7" "b1 b1 esc esc a7 a7" "ph ph ph ph ph ph" "a4 a4 pv b2 a3 a8" "a4 a4 pv a2 a2 a8" "buf buf pv a2 a2 a8" "a5 adm pv a1 a1 a8" "a5 adm ing a1 a1 a8"`
const PA = `"ter ter ter" "a11 gal a10" "a11 gal b3" "a11 gal a9" "bal bal a9"`

function colorEstado(estado: string) {
  if (estado === 'Lleno') return 'border-l-red-500'
  if (estado === 'Cerrado' || estado === 'No se da') return 'border-l-slate-300 text-slate-400'
  if (estado === 'Nuevo') return 'border-l-sky-400'
  return 'border-l-marca-600/60'
}

function Aula({ num, clases, franjas }: { num: number; clases: Taller[]; franjas: string[][] }) {
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
              </li>
            )
          return empiezan.map((c) => (
            <li key={c.id} className={`border-l-[3px] pl-1.5 text-xs leading-tight ${colorEstado(c.estado)}`}>
              <div className="font-semibold tabular-nums">
                {c.desde}–{c.hasta}
              </div>
              <div className="text-slate-800">{c.nombre}</div>
              <div className="text-slate-500">
                {c.docente} · {c.inscriptos ?? 0} insc.
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

export default function Plano() {
  const [talleres, setTalleres] = useState<Taller[]>([])
  const [dia, setDia] = useState(0)

  useEffect(() => {
    api<Taller[]>('/api/talleres').then(setTalleres)
  }, [])

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marca-800">Plano por día</h1>
          <p className="text-sm text-slate-500">
            Qué taller funciona en cada aula. Franjas por aula (9, 11, 15, 17 y 19 hs; sábados 9 a 11:50); LIBRE donde no hay actividad. Rojo: lleno · gris: cerrado · celeste: nuevo.
          </p>
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

      <p className="text-sm text-slate-600">
        <b>{DIAS[dia]}</b> · {total} clases
        {sinAula.length > 0 && <> · {sinAula.length} sin aula numerada: {sinAula.map((t) => t.nombre).join(', ')}</>}
      </p>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        <section>
          <h2 className="font-semibold text-slate-500 mb-2">Planta baja</h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateAreas: PB, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gridAutoRows: 'minmax(56px, auto)' }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Aula key={n} num={n} clases={porAula[n] ?? []} franjas={franjas} />
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
              <Aula key={n} num={n} clases={porAula[n] ?? []} franjas={franjas} />
            ))}
            <Fijo area="ter" texto="Terraza" />
            <Fijo area="gal" texto="Galería" vertical />
            <Fijo area="b3" texto="Baño" />
            <Fijo area="bal" texto="Balcón" />
          </div>
        </section>
      </div>
    </div>
  )
}
