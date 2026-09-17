const BASE = import.meta.env.VITE_API_URL || ''

export function getToken() {
  return localStorage.getItem('atl_token') || ''
}

export function getNombre() {
  return localStorage.getItem('atl_nombre') || ''
}

export function getUsuario() {
  return localStorage.getItem('atl_usuario') || ''
}

export function cerrarSesion() {
  localStorage.removeItem('atl_token')
  localStorage.removeItem('atl_nombre')
  localStorage.removeItem('atl_usuario')
  location.reload()
}

export async function login(nombre: string, password: string) {
  const r = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nombre, password }),
  })
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => ({}))
    throw new Error(cuerpo.detail || 'Usuario o contraseña incorrectos')
  }
  const datos = await r.json()
  localStorage.setItem('atl_token', datos.token)
  localStorage.setItem('atl_nombre', datos.nombre)
  localStorage.setItem('atl_usuario', datos.usuario)
  return datos
}

export async function api<T = any>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${getToken()}`,
      ...(opciones.headers || {}),
    },
  })
  if (r.status === 401) {
    cerrarSesion()
    throw new Error('Sesión vencida')
  }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || 'Error de conexión')
  return r.json()
}

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function fechaLarga(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
