import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cerrarSesion, getNombre, getToken, login } from './api'

const SECCIONES = [
  { to: '/', texto: 'Inicio', end: true },
  { to: '/agenda', texto: 'Agenda' },
  { to: '/talleres', texto: 'Talleres' },
  { to: '/docentes', texto: 'Docentes' },
  { to: '/alumnos', texto: 'Alumnos' },
  { to: '/espacios', texto: 'Espacios' },
  { to: '/tareas', texto: 'Tareas' },
  { to: '/gastos', texto: 'Gastos' },
  { to: '/compras', texto: 'Compras' },
  { to: '/feedback', texto: 'Feedback' },
  { to: '/objetivos', texto: 'Objetivos' },
  { to: '/accesos', texto: 'Accesos' },
]

function Login({ onEntrar }: { onEntrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError('')
    try {
      await login(nombre, password)
      onEntrar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-marca-800">Aulas para el Tiempo Libre</h1>
          <p className="text-sm text-slate-500">Panel de gestión — 1º cuatrimestre 2026</p>
        </div>
        <input className="campo" placeholder="Tu usuario" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input
          className="campo"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="boton w-full justify-center" disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [autenticado, setAutenticado] = useState(!!getToken())
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (!autenticado) return <Login onEntrar={() => setAutenticado(true)} />

  return (
    <div className="min-h-screen">
      <header className="bg-marca-700 text-white sticky top-0 z-20 shadow">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight truncate">Aulas para el Tiempo Libre</p>
            <p className="text-xs text-marca-100">1º cuatrimestre 2026</p>
          </div>
          <nav className="hidden md:flex gap-1">
            {SECCIONES.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-white text-marca-700 font-medium' : 'hover:bg-marca-600'}`
                }
              >
                {s.texto}
              </NavLink>
            ))}
          </nav>
          <button className="hidden md:block text-xs text-marca-100 hover:text-white" onClick={cerrarSesion}>
            {getNombre()} · salir
          </button>
          <button className="md:hidden rounded-lg border border-white/30 px-3 py-1.5 text-sm" onClick={() => setMenuAbierto(!menuAbierto)}>
            Menú
          </button>
        </div>
        {menuAbierto && (
          <nav className="md:hidden border-t border-white/20 px-4 pb-3 grid grid-cols-2 gap-1">
            {SECCIONES.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-white text-marca-700 font-medium' : 'hover:bg-marca-600'}`
                }
              >
                {s.texto}
              </NavLink>
            ))}
            <button className="rounded-lg px-3 py-2 text-left text-sm hover:bg-marca-600" onClick={cerrarSesion}>
              Salir
            </button>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
