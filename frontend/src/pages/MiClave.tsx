import { useState } from 'react'
import { api, getNombre } from '../api'

export default function MiClave() {
  const [claves, setClaves] = useState({ password_actual: '', password_nueva: '', repetir: '' })
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function cambiar() {
    setError('')
    setAviso('')
    if (claves.password_nueva !== claves.repetir) {
      setError('La contraseña nueva y la repetición no coinciden')
      return
    }
    try {
      await api('/api/usuarios/clave', {
        method: 'POST',
        body: JSON.stringify({ password_actual: claves.password_actual, password_nueva: claves.password_nueva }),
      })
      setClaves({ password_actual: '', password_nueva: '', repetir: '' })
      setAviso('Contraseña cambiada. La próxima vez entrá con la nueva.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="max-w-sm space-y-4">
      <h2 className="text-lg font-semibold text-marca-800">Cambiar mi contraseña</h2>
      <p className="text-sm text-slate-500">Usuario: {getNombre()}</p>
      <div className="tarjeta p-4 space-y-3">
        <input className="campo" type="password" placeholder="Contraseña actual" value={claves.password_actual} onChange={(e) => setClaves({ ...claves, password_actual: e.target.value })} />
        <input className="campo" type="password" placeholder="Contraseña nueva (mínimo 8 caracteres)" value={claves.password_nueva} onChange={(e) => setClaves({ ...claves, password_nueva: e.target.value })} />
        <input className="campo" type="password" placeholder="Repetir la contraseña nueva" value={claves.repetir} onChange={(e) => setClaves({ ...claves, repetir: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {aviso && <p className="text-sm text-emerald-700">{aviso}</p>}
        <button className="boton w-full justify-center" onClick={cambiar}>Cambiar contraseña</button>
      </div>
    </div>
  )
}
