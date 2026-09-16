import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

type Resumen = {
  periodo: string
  talleres: number
  alumnos: number
  inscripciones: number
  inscripciones_sin_taller: number
  docentes: number
  espacios: number
  fichas_completas: number
  fichas_completas_pct: number
  alumnos_multi_taller: number
  por_area: [string, number][]
  ocupacion: { espacio: string; clases: number; capacidad: number | null }[]
  talleres_llenos: { id: number; nombre: string; inscriptos: number; cupo_max: number | null }[]
  talleres_bajos: { id: number; nombre: string; inscriptos: number; dia_nombre: string; desde: string }[]
  hoy: { fecha: string; dia_nombre: string; clases: number }
}

function Dato({ valor, texto, detalle }: { valor: string | number; texto: string; detalle?: string }) {
  return (
    <div className="tarjeta p-4">
      <p className="text-2xl font-semibold text-marca-700">{valor}</p>
      <p className="text-sm text-slate-600">{texto}</p>
      {detalle && <p className="text-xs text-slate-400 mt-1">{detalle}</p>}
    </div>
  )
}

export default function Inicio() {
  const [r, setR] = useState<Resumen | null>(null)

  useEffect(() => {
    api<Resumen>('/api/resumen').then(setR)
  }, [])

  if (!r) return <p className="text-slate-500">Cargando…</p>

  const maxClases = Math.max(...r.ocupacion.map((o) => o.clases), 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold text-marca-800">Diagnóstico — {r.periodo}</h2>
        <Link to="/agenda" className="text-sm text-marca-600 hover:underline">
          Hoy hay {r.hoy.clases} clases · ver agenda →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dato valor={r.talleres} texto="talleres semanales" detalle={`en ${r.espacios} espacios`} />
        <Dato valor={r.alumnos} texto="alumnos" detalle={`${r.inscripciones} inscripciones`} />
        <Dato valor={r.docentes} texto="docentes con ficha" />
        <Dato
          valor={`${r.fichas_completas_pct}%`}
          texto="fichas de alumno completas"
          detalle={`${r.fichas_completas} de ${r.alumnos} tienen DNI y contacto`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="tarjeta p-4">
          <h3 className="font-medium text-marca-800 mb-3">Uso de los espacios</h3>
          <div className="space-y-1.5">
            {r.ocupacion.map((o) => (
              <div key={o.espacio} className="flex items-center gap-2 text-sm">
                <span className="w-44 shrink-0 truncate text-slate-600">{o.espacio}</span>
                <span className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                  <span className="block h-full bg-marca-600" style={{ width: `${(o.clases / maxClases) * 100}%` }} />
                </span>
                <span className="w-20 text-right tabular-nums text-slate-500">{o.clases} clases</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tarjeta p-4">
          <h3 className="font-medium text-marca-800 mb-3">Inscripciones por área</h3>
          <div className="space-y-1.5">
            {r.por_area.map(([area, cantidad]) => (
              <div key={area} className="flex items-center gap-2 text-sm">
                <span className="w-44 shrink-0 truncate text-slate-600">{area}</span>
                <span className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                  <span
                    className="block h-full bg-amber-500"
                    style={{ width: `${(cantidad / r.por_area[0][1]) * 100}%` }}
                  />
                </span>
                <span className="w-12 text-right tabular-nums text-slate-500">{cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="tarjeta p-4">
          <h3 className="font-medium text-marca-800 mb-2">Talleres al tope del cupo</h3>
          {r.talleres_llenos.length === 0 && <p className="text-sm text-slate-500">Ninguno supera su cupo cargado.</p>}
          <ul className="text-sm space-y-1">
            {r.talleres_llenos.slice(0, 8).map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate text-slate-600">{t.nombre}</span>
                <span className="tabular-nums text-slate-500">
                  {t.inscriptos}/{t.cupo_max}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="tarjeta p-4">
          <h3 className="font-medium text-marca-800 mb-2">Talleres con 3 inscriptos o menos</h3>
          <ul className="text-sm space-y-1">
            {r.talleres_bajos.slice(0, 8).map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate text-slate-600">{t.nombre}</span>
                <span className="tabular-nums text-slate-500">{t.inscriptos}</span>
              </li>
            ))}
          </ul>
          {r.talleres_bajos.length > 8 && (
            <p className="text-xs text-slate-400 mt-2">y {r.talleres_bajos.length - 8} más</p>
          )}
        </div>

        <div className="tarjeta p-4 space-y-2">
          <h3 className="font-medium text-marca-800">Para revisar</h3>
          <p className="text-sm text-slate-600">
            <Link to="/alumnos?incompletos=1" className="text-marca-600 hover:underline">
              {r.alumnos - r.fichas_completas} fichas de alumno incompletas
            </Link>{' '}
            (sin DNI o sin contacto).
          </p>
          <p className="text-sm text-slate-600">
            {r.inscripciones_sin_taller} inscripciones cuyo taller no coincide con ningún taller de la grilla.
          </p>
          <p className="text-sm text-slate-600">{r.alumnos_multi_taller} alumnos cursan más de un taller.</p>
        </div>
      </div>
    </div>
  )
}
