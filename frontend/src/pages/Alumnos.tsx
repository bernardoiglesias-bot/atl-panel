import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Alumno } from '../tipos'

const PAGOS = ['Sin dato', 'Al día', 'Debe', 'Bonificado']

function Ficha({ alumno, onCerrar, onGuardado }: { alumno: Alumno; onCerrar: () => void; onGuardado: () => void }) {
  const [form, setForm] = useState({
    nombre: alumno.nombre, dni: alumno.dni, email: alumno.email, telefono: alumno.telefono,
    emergencia: alumno.emergencia, obra_social: alumno.obra_social, notas: alumno.notas,
  })
  const [inscripciones, setInscripciones] = useState(alumno.inscripciones)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    await api(`/api/alumnos/${alumno.id}`, { method: 'PUT', body: JSON.stringify(form) })
    setGuardando(false)
    onGuardado()
  }

  async function cambiarPago(id: number, estado_pago: string) {
    setInscripciones(inscripciones.map((i) => (i.id === id ? { ...i, estado_pago } : i)))
    await api(`/api/inscripciones/${id}/pago`, { method: 'PUT', body: JSON.stringify({ estado_pago }) })
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4 overflow-auto" onClick={onCerrar}>
      <div className="tarjeta w-full max-w-xl p-5 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-marca-800">{alumno.nombre}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="campo sm:col-span-2" placeholder="Nombre y apellido" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="campo" placeholder="DNI" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          <input className="campo" placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <input className="campo sm:col-span-2" placeholder="Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="campo" placeholder="Contacto de emergencia" value={form.emergencia} onChange={(e) => setForm({ ...form, emergencia: e.target.value })} />
          <input className="campo" placeholder="Obra social" value={form.obra_social} onChange={(e) => setForm({ ...form, obra_social: e.target.value })} />
          <textarea className="campo sm:col-span-2" rows={2} placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        </div>

        <div>
          <p className="font-medium text-marca-800 mb-2">Talleres y pago</p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {inscripciones.map((i) => (
              <div key={i.id} className="px-3 py-2 flex gap-3 items-center text-sm">
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{i.taller}</span>
                  <span className="text-slate-400">
                    {i.dia_nombre} {i.desde} · {i.area}
                  </span>
                </span>
                <select className="campo w-auto py-1" value={i.estado_pago} onChange={(e) => cambiarPago(i.id, e.target.value)}>
                  {PAGOS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="boton-suave" onClick={onCerrar}>Cerrar</button>
          <button className="boton" onClick={guardar} disabled={guardando}>Guardar ficha</button>
        </div>
      </div>
    </div>
  )
}

export default function Alumnos() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [incompletos, setIncompletos] = useState(params.get('incompletos') === '1')
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState<{ total: number; alumnos: Alumno[] } | null>(null)
  const [abierto, setAbierto] = useState<Alumno | null>(null)

  async function cargar() {
    const d = await api<{ total: number; alumnos: Alumno[] }>(
      `/api/alumnos?q=${encodeURIComponent(q)}&solo_incompletos=${incompletos}&pagina=${pagina}`,
    )
    setDatos(d)
  }

  useEffect(() => {
    const t = setTimeout(cargar, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, incompletos, pagina])

  const paginas = datos ? Math.ceil(datos.total / 50) : 1

  return (
    <div className="space-y-4">
      <div className="tarjeta p-4 flex flex-wrap gap-3 items-center">
        <input
          className="campo flex-1 min-w-[12rem]"
          placeholder="Buscar por nombre, DNI o mail"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPagina(1)
          }}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incompletos}
            onChange={(e) => {
              setIncompletos(e.target.checked)
              setPagina(1)
              setParams(e.target.checked ? { incompletos: '1' } : {})
            }}
          />
          Sólo fichas incompletas
        </label>
        <span className="text-sm text-slate-500">{datos?.total ?? 0} alumnos</span>
      </div>

      <div className="tarjeta overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Alumno</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">DNI</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Contacto</th>
              <th className="text-left px-3 py-2 font-medium">Talleres</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {datos?.alumnos.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setAbierto(a)}>
                <td className="px-3 py-2">{a.nombre}</td>
                <td className="px-3 py-2 text-slate-500 hidden sm:table-cell">{a.dni || '—'}</td>
                <td className="px-3 py-2 text-slate-500 hidden md:table-cell truncate max-w-[16rem]">
                  {a.email || a.telefono || '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {a.inscripciones.map((i) => i.taller).join(', ')}
                </td>
                <td className="px-3 py-2 text-right">
                  {!a.ficha_completa && <span className="etiqueta bg-amber-100 text-amber-800">ficha incompleta</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="boton-suave" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </button>
          <span className="text-sm text-slate-500">
            Página {pagina} de {paginas}
          </span>
          <button className="boton-suave" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </button>
        </div>
      )}

      {abierto && (
        <Ficha
          alumno={abierto}
          onCerrar={() => setAbierto(null)}
          onGuardado={() => {
            setAbierto(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
