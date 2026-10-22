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
  periodo: string
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

export type Tarea = {
  id: number
  titulo: string
  detalle: string
  plazo: string
  estado: string
  responsable: string
  area: string
  espacio_id: number | null
  espacio: string
  objetivo_id: number | null
  objetivo: string
  vence: string | null
  creada: string | null
  cerrada: string | null
  vencida: boolean
}

export type Gasto = {
  id: number
  concepto: string
  detalle: string
  rubro: string
  etapa: string
  monto_presupuestado: number | null
  monto_adelanto: number | null
  monto_rendido: number | null
  proveedor: string
  solicitante: string
  espacio_id: number | null
  espacio: string
  fecha: string | null
  fecha_necesidad: string | null
  notas: string
  pendiente_rendir: number
}

export type GastosResp = {
  gastos: Gasto[]
  totales: { presupuestado: number; adelantado: number; rendido: number; pendiente_rendir: number }
  por_etapa: Record<string, number>
}

export type Feedback = {
  id: number
  fecha: string | null
  docente_id: number | null
  personal_id: number | null
  persona_texto: string
  persona: string
  rol: string
  tipo: string
  valoracion: number | null
  tema: string
  comentario: string
  acuerdos: string
  registrado_por: string
}

export type Seguimiento = {
  id: number
  fecha: string
  valor: number | null
  comentario: string
}

export type Objetivo = {
  id: number
  titulo: string
  detalle: string
  responsable: string
  indicador: string
  unidad: string
  valor_inicial: number | null
  valor_meta: number | null
  valor_actual: number | null
  avance: number | null
  estado: string
  vence: string | null
  automatico: boolean
  tareas: { id: number; titulo: string; estado: string; plazo: string }[]
  seguimientos: Seguimiento[]
}

export type Usuario = {
  id: number
  usuario: string
  nombre: string
  activo: boolean
  creado: string
  ultimo_ingreso: string | null
}

export type Indicador = { clave: string; texto: string; valor: number | null }

export type Personal = { id: number; nombre: string; funcion: string; email: string; telefono: string }

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

export type Pedido = {
  id: number
  articulo: string
  cantidad: string
  sector: string
  urgencia: string
  estado: string
  pedido_por: string
  nota: string
  creado: string
  resuelto: string | null
}
