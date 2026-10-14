import { useEffect, useState } from 'react'
import type { Pedido } from '../tipos'

const BASE = import.meta.env.VITE_API_URL || ''

const COLOR_URGENCIA: Record<string, string> = {
  'Se acabó': 'bg-rose-100 text-rose-700',
  'Queda poco': 'bg-amber-100 text-amber-700',
  'Para reponer': 'bg-sky-100 text-sky-700',
}

type Datos = { pedidos: Pedido[]; sectores: string[]; urgencias: string[] }

export default function Pedir() {
  const codigo = new URLSearchParams(location.search).get('c') || ''
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState(localStorage.getItem('atl_pedir_nombre') || '')
  const [form, setForm] = useState({ articulo: '', cantidad: '', sector: 'Limpieza', urgencia: 'Queda poco', nota: '' })
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState('')

  async function cargar() {
    const r = await fetch(`${BASE}/api/publico/pedidos?c=${encodeURIComponent(codigo)}`)
    if (!r.ok) {
      setError('Este link no es válido. Pedile uno nuevo a coordinación.')
      return
    }
    setDatos(await r.json())
  }

  useEffect(() => {
    cargar()
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !form.articulo.trim()) {
      setError('Poné tu nombre y qué hay que comprar.')
      return
    }
    setEnviando(true)
    setError('')
    localStorage.setItem('atl_pedir_nombre', nombre)
    const r = await fetch(`${BASE}/api/publico/pedidos?c=${encodeURIComponent(codigo)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, pedido_por: nombre }),
    })
    setEnviando(false)
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).detail || 'No se pudo guardar, probá de nuevo.')
      return
    }
    setListo(form.articulo)
    setForm({ ...form, articulo: '', cantidad: '', nota: '' })
    cargar()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-marca-700 text-white">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <p className="font-semibold leading-tight">Aulas para el Tiempo Libre</p>
          <p className="text-xs text-marca-100">Cosas que hay que comprar</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4 space-y-4">
        {error && !datos && <p className="tarjeta p-4 text-rose-700">{error}</p>}
        {datos && (
          <>
            <form onSubmit={enviar} className="tarjeta p-4 space-y-3">
              <p className="text-sm text-slate-600">
                Anotá acá lo que se está por acabar, así coordinación lo compra a tiempo.
              </p>
              <input className="campo" placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <input className="campo" placeholder="Qué hay que comprar" value={form.articulo} onChange={(e) => setForm({ ...form, articulo: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="campo" placeholder="Cantidad (ej. 6 rollos)" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
                <select className="campo" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                  {datos.sectores.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {datos.urgencias.map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setForm({ ...form, urgencia: u })}
                    className={`text-sm px-3 py-1.5 rounded-lg border ${
                      form.urgencia === u ? COLOR_URGENCIA[u] + ' border-transparent font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <textarea className="campo" rows={2} placeholder="Nota (marca, dónde se compra…) — opcional" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {listo && !error && <p className="text-sm text-emerald-700">Anotado: {listo}</p>}
              <button className="boton w-full justify-center" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Anotar'}
              </button>
            </form>

            <div className="space-y-2">
              <h3 className="font-medium text-marca-800">Ya pedido, falta comprar ({datos.pedidos.length})</h3>
              {datos.pedidos.length === 0 && <p className="text-sm text-slate-400">Nada pendiente.</p>}
              {datos.pedidos.map((p) => (
                <div key={p.id} className="tarjeta p-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-marca-800">
                      {p.articulo}
                      {p.cantidad && <span className="text-slate-500 font-normal"> · {p.cantidad}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{p.sector} · {p.pedido_por} · {p.creado}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${COLOR_URGENCIA[p.urgencia] || ''}`}>{p.urgencia}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
