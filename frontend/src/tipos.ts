export type Espacio = {
  id: number
  nombre: string
  ubicacion: string
  capacidad: number | null
  uso: string
  activo: boolean
  clases_semana?: number
}

export type Taller = {
  id: number
  nombre: string
  area: string
  dia: number
  dia_nombre: string
  desde: string
  hasta: string
  turno: string
  estado: string
  cupo_max: number | null
  observacion: string
  difusion: string
  activo: boolean
  espacio: Espacio | null
  espacio_id: number | null
  docente: string
  docente_id: number | null
  docente_texto: string
  inscriptos: number | null
}

export type ItemAgenda = {
  tipo: 'clase' | 'evento' | 'suspendida'
  id: number
  titulo: string
  desde: string
  hasta: string
  espacio: Espacio | null
  detalle: string
  motivo?: string
  subtipo?: string
  inscriptos?: number
  cupo_max?: number | null
  estado?: string
  area?: string
}

export type Agenda = {
  fecha: string
  dia_nombre: string
  espacios: Espacio[]
  items: ItemAgenda[]
}

export type Inscripcion = {
  id: number
  taller_id: number | null
  taller: string
  area: string
  turno: string
  estado_pago: string
  dia_nombre: string
  desde: string
}

export type Alumno = {
  id: number
  nombre: string
  dni: string
  email: string
  telefono: string
  emergencia: string
  obra_social: string
  notas: string
  ficha_completa: boolean
  inscripciones: Inscripcion[]
}

export type Docente = {
  id: number
  nombre: string
  dni: string
  email: string
  celular: string
  nacimiento: string
  facturacion: string
  necesidades: string
  maquinaria: string
  sugerencias: string
  cupo_min: string
  cupo_max: string
  talleres: { id: number; nombre: string; dia_nombre: string; desde: string; hasta: string; espacio: string }[]
}

export type Evento = {
  id: number
  titulo: string
  tipo: string
  fecha: string
  desde: string
  hasta: string
  espacio: Espacio | null
  espacio_id: number | null
  responsable: string
  notas: string
}
