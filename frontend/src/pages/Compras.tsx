import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Pedido } from '../tipos'

const COLOR_URGENCIA: Record<string, string> = {
  'Se acabó': 'bg-rose-100 text-rose-700',
  'Queda poco': 'bg-amber-100 text-amber-700',
  'Para reponer': 'bg-sky-100 text-sky-700',
}

const VACIO = { articulo: '', cantidad: '', sector: 'Limpieza', urgencia: 'Queda poco', pedido_por: '', nota: '' }

export default function Compras() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [link, setLink] = useState('')
  const [sectores, setSectores] = useState<string[]>([])
  const [urgencias, setUrgencias] = useState<string[]>([])
  const [verResueltos, setVerResueltos] = useState(false)
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState(VACIO)
  const [copiado, setCopiado] = useState(false)

  async function cargar() {
    const [p, l] = await Promise.all([
      api<Pedido[]>('/api/pedidos'),
      api<{ ruta: string; sectores: string[]; urgencias: string[] }>('/api/pedidos/link'),
    ])
    setPedidos(p)
    setLink(`${location.origin}${l.ruta}`)
    setSectores(l.sectores)
    setUrgencias(l.urgencias)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function guardar() {
    const cuerpo = JSON.stringify(form)
    if (editando === 'nuevo') await api('/api/pedidos', { method: 'POST', body: cuerpo })
    else await api(`/api/pedidos/${editando}`, { method: 'PUT', body: cuerpo })
    setEditando(null)
    cargar()
  }

  async function borrar() {
    if (editando === 'nuevo' || editando === null) return
    await api(`/api/pedidos/${editando}`, { method: 'DELETE' })
    setEditando(null)
    cargar()
  }

  async function cambiarEstado(p: Pedido, estado: string) {
    await api(`/api/pedidos/${p.id}/estado`, { method: 'PUT', body: JSON.stringify({ estado }) })
    cargar()
  }

  async function copiar() {
    await navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const pendientes = pedidos.filter((p) => p.estado === 'Pendiente')
  const resueltos = pedidos.filter((p) => p.estado !== 'Pendiente')
  const porSector = sectores.filter((s) => pendientes.some((p) => p.sector === s))
  const otros = pendientes.filter((p) => !sectores.includes(p.sector))

  function Tarjeta({ p }: { p: Pedido }) {
    return (
      <div className={`tarjeta p-3 space-y-2 ${p.estado !== 'Pendiente' ? 'opacity-60' : ''}`}>
        <button
          className="text-left w-full"
          onClick={() => {
            setForm({ articulo: p.articulo, cantidad: p.cantidad, sector: p.sector, urgencia: p.urgencia, pedido_por: p.pedido_por, nota: p.nota })
            setEditando(p.id)
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-marca-800">
              {p.articulo}
              {p.cantidad && <span className="text-slate-500 font-normal"> · {p.cantidad}</span>}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${COLOR_URGENCIA[p.urgencia] || 'bg-slate-100 text-slate-600'}`}>
              {p.urgencia}
            </span>
          </div>
          {p.nota && <p className="text-sm text-slate-500">{p.nota}</p>}
          <p className="text-xs text-slate-400 mt-1">
            {p.pedido_por || 'sin nombre'} · {p.creado}
            {p.resuelto && ` · ${p.estado.toLowerCase()} el ${p.resuelto}`}
          </p>
        </button>
        <div className="flex gap-1">
          {['Pendiente', 'Comprado', 'Descartado'].map((e) => (
            <button
              key={e}
              onClick={() => cambiarEstado(p, e)}
              className={`text-xs px-2 py-1 rounded ${
                p.estado === e ? 'bg-marca-100 text-marca-800 font-medium' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-marca-800">Compras</h2>
          <p className="text-sm text-slate-500">
            {pendientes.length} cosas por comprar
            {pendientes.some((p) => p.urgencia === 'Se acabó') && (
              <span className="text-rose-600"> · {pendientes.filter((p) => p.urgencia === 'Se acabó').length} ya se acabaron</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={verResueltos} onChange={(e) => setVerResueltos(e.target.checked)} />
            Ver compradas
          </label>
          <button
            className="boton"
            onClick={() => {
              setForm(VACIO)
              setEditando('nuevo')
            }}
          >
            + Pedido
          </button>
        </div>
      </div>

      <div className="tarjeta p-4 space-y-2">
        <p className="font-medium text-marca-800">Link para el personal</p>
        <p className="text-sm text-slate-500">
          Pasale este link al personal administrativo y de limpieza (por WhatsApp o pegado en la oficina). Entran sin
          contraseña y sólo pueden cargar lo que hace falta comprar; no ven el resto del panel.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="campo flex-1 min-w-[220px] text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="boton-suave" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <a className="boton-suave" href={link} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      </div>

      {pendientes.length === 0 && <p className="text-sm text-slate-400">No hay nada pendiente de comprar.</p>}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {porSector.map((s) => (
          <div key={s} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-medium text-marca-800">{s}</h3>
              <span className="text-sm text-slate-400">{pendientes.filter((p) => p.sector === s).length}</span>
            </div>
            {pendientes.filter((p) => p.sector === s).map((p) => <Tarjeta key={p.id} p={p} />)}
          </div>
        ))}
        {otros.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-marca-800">Otros</h3>
            {otros.map((p) => <Tarjeta key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {verResueltos && resueltos.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-marca-800">Compradas o descartadas</h3>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {resueltos.map((p) => <Tarjeta key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {editando !== null && (
        <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center p-4" onClick={() => setEditando(null)}>
          <div className="tarjeta w-full max-w-lg p-5 space-y-3" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-marca-800">{editando === 'nuevo' ? 'Nuevo pedido' : 'Editar pedido'}</h3>
            <input className="campo" placeholder="Qué hay que comprar" value={form.articulo} onChange={(e) => setForm({ ...form, articulo: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="campo" placeholder="Cantidad (ej. 6 rollos)" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              <input className="campo" placeholder="Quién lo pide" value={form.pedido_por} onChange={(e) => setForm({ ...form, pedido_por: e.target.value })} />
              <select className="campo" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {sectores.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="campo" value={form.urgencia} onChange={(e) => setForm({ ...form, urgencia: e.target.value })}>
                {urgencias.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <textarea className="campo" rows={2} placeholder="Nota (marca, dónde se compra, etc.)" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            <div className="flex justify-between">
              {editando !== 'nuevo' ? (
                <button className="text-sm text-rose-600 hover:underline" onClick={borrar}>Borrar</button>
              ) : <span />}
              <div className="flex gap-2">
                <button className="boton-suave" onClick={() => setEditando(null)}>Cancelar</button>
                <button className="boton" onClick={guardar}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
