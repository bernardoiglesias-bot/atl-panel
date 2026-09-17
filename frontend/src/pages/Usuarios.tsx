import { useEffect, useState } from 'react'
import { api, getUsuario } from '../api'
import type { Usuario } from '../tipos'

const NUEVO = { usuario: '', nombre: '', password: '' }
const CLAVES = { password_actual: '', password_nueva: '' }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [form, setForm] = useState(NUEVO)
  const [claves, setClaves] = useState(CLAVES)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const yo = getUsuario()

  async function cargar() {
    setUsuarios(await api<Usuario[]>('/api/usuarios'))
  }

  useEffect(() => {
    cargar()
  }, [])

  async function crear() {
    setError('')
    setAviso('')
    try {
      await api('/api/usuarios', { method: 'POST', body: JSON.stringify(form) })
      setForm(NUEVO)
      setAviso('Acceso creado')
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function cambiarClave() {
    setError('')
    setAviso('')
    try {
      await api('/api/usuarios/clave', { method: 'POST', body: JSON.stringify(claves) })
      setClaves(CLAVES)
      setAviso('Contraseña cambiada')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function desactivar(u: Usuario) {
    if (!confirm(`¿Dar de baja el acceso de ${u.nombre}?`)) return
    setError('')
    try {
      await api(`/api/usuarios/${u.id}`, { method: 'DELETE' })
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-marca-800">Accesos</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {aviso && <p className="text-sm text-emerald-700">{aviso}</p>}

      <div className="tarjeta divide-y">
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-marca-800">
                {u.nombre} {u.usuario === yo && <span className="text-xs text-slate-400">(vos)</span>}
              </p>
              <p className="text-sm text-slate-500">
                {u.usuario} · {u.activo ? 'activo' : 'dado de baja'}
                {u.ultimo_ingreso ? ` · último ingreso ${u.ultimo_ingreso}` : ' · nunca entró'}
              </p>
            </div>
            {u.activo && u.usuario !== yo && (
              <button className="boton-suave" onClick={() => desactivar(u)}>
                Dar de baja
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="tarjeta p-4 space-y-3">
          <h3 className="font-semibold text-marca-800">Nuevo acceso</h3>
          <input className="campo" placeholder="Nombre y apellido" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className="campo" placeholder="Usuario (sin espacios)" value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
          <input
            className="campo"
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button className="boton w-full justify-center" onClick={crear}>
            Crear acceso
          </button>
        </div>

        <div className="tarjeta p-4 space-y-3">
          <h3 className="font-semibold text-marca-800">Cambiar mi contraseña</h3>
          <input
            className="campo"
            type="password"
            placeholder="Contraseña actual"
            value={claves.password_actual}
            onChange={(e) => setClaves({ ...claves, password_actual: e.target.value })}
          />
          <input
            className="campo"
            type="password"
            placeholder="Contraseña nueva (mínimo 8 caracteres)"
            value={claves.password_nueva}
            onChange={(e) => setClaves({ ...claves, password_nueva: e.target.value })}
          />
          <button className="boton w-full justify-center" onClick={cambiarClave}>
            Cambiar contraseña
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        La sesión se cierra sola a las 12 horas y, después de 5 intentos fallidos seguidos, ese usuario queda bloqueado 15 minutos.
      </p>
    </div>
  )
}
