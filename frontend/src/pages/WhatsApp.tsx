import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Taller } from '../tipos'

const NUMERO_ATL = '5492617003923'

type Contacto = { id: number; nombre: string; telefono: string; celular: string | null; motivo: string }
type Lista = {
  id: number; nombre: string; area: string; dia_nombre: string; desde: string; hasta: string; estado: string
  espacio: string; docente: string; etiqueta: string; alumnos: Contacto[]
}
type Listas = { periodo: string; talleres: Lista[]; contactos: (Contacto & { etiquetas: string[] })[] }
type Texto = { titulo: string; donde?: string; texto: string; atajo?: string }

const HORARIO = '[lunes a viernes de 9 a 13 y de 16 a 20]'

const INSCRIPCION_2027 = '*Inscripción 2027*\n• Hasta el 20/12/2026: $57.000\n• Desde febrero 2027: $70.000'
const CUOTAS_2027 =
  '*Cuota mensual 2027*\n• Talleres de 3 hs: $70.000 ($64.000 pagando hasta el 10 de cada mes)\n• Talleres de 2 hs: $56.000 ($51.000 pagando hasta el 10 de cada mes)'

const PERFIL: Texto[] = [
  { titulo: 'Nombre de la empresa', donde: 'Herramientas para la empresa → Perfil de la empresa → Nombre', texto: 'Aulas para el Tiempo Libre - UNCuyo' },
  { titulo: 'Categoría', donde: 'Perfil de la empresa → Categoría (si no aparece, elegí "Escuela")', texto: 'Educación' },
  {
    titulo: 'Descripción',
    donde: 'Perfil de la empresa → Descripción (hasta 512 letras)',
    texto:
      'Talleres de idiomas, artes visuales, música, danza, diseño, informática, bienestar y cultura general para personas adultas. Un programa de la Universidad Nacional de Cuyo.\n\nPor este WhatsApp oficial te informamos inscripciones, horarios, aulas y novedades de tu taller. Agendá este número para recibir los avisos.',
  },
  { titulo: 'Horario de atención', donde: 'Perfil de la empresa → Horario → "Horario personalizado"', texto: 'Lunes a viernes: [9 a 13 y 16 a 20]' },
  { titulo: 'Dirección', donde: 'Perfil de la empresa → Dirección', texto: '[calle y número de la sede], Mendoza' },
  { titulo: 'Correo y sitio web', donde: 'Perfil de la empresa → Correo electrónico / Sitio web', texto: '[mail institucional del programa]\n[página web o red social del programa]' },
]

const AUTOMATICOS: Texto[] = [
  {
    titulo: 'Mensaje de bienvenida',
    donde: 'Herramientas para la empresa → Mensaje de bienvenida → activar → Destinatarios: "Todos"',
    texto:
      '¡Hola! Gracias por escribir a *Aulas para el Tiempo Libre* de la UNCuyo. Este es nuestro WhatsApp oficial.\n\nPara recibir los avisos de tu taller, *agendá este número* como "Aulas para el Tiempo Libre".\n\nContanos tu consulta y, si ya cursás, tu *nombre completo* y el *taller* al que vas. Te respondemos a la brevedad.',
  },
  {
    titulo: 'Mensaje de ausencia',
    donde: 'Herramientas para la empresa → Mensaje de ausencia → activar → Horario: "Fuera del horario comercial" → Destinatarios: "Todos"',
    texto: `Hola, gracias por escribir a *Aulas para el Tiempo Libre*. En este momento estamos fuera del horario de atención (${HORARIO}).\n\nDejanos tu consulta con tu nombre completo y te respondemos apenas volvamos.`,
  },
]

const ETIQUETAS = ['Consulta nueva', 'Inscripción 2027', 'Lista de espera', 'Pago pendiente', 'Pago recibido', 'Ficha incompleta', 'Docente', 'Resuelto']

const RAPIDAS: Texto[] = [
  { atajo: 'hola', titulo: 'Saludo', texto: 'Hola, ¿cómo estás? Te escribimos de Aulas para el Tiempo Libre. ¿En qué te podemos ayudar?' },
  { atajo: 'datos', titulo: 'Pedir datos', texto: 'Para ayudarte mejor, ¿nos pasás tu *nombre completo*, tu *DNI* y el *taller* al que vas o que te interesa?' },
  {
    atajo: 'inscripcion', titulo: 'Inscripciones 2027',
    texto: 'Las inscripciones 2027 son del [fecha de inicio] al [fecha de cierre]. Te podés inscribir [en la sede / en este link: ...]. Necesitás tu DNI y elegir el taller y el horario.\n\n' +
      INSCRIPCION_2027 +
      '\n\nSi querés, te pasamos la grilla de talleres.',
  },
  { atajo: 'grilla', titulo: 'Grilla de talleres', texto: 'Te compartimos la grilla de talleres 2027. Si te interesa alguno, respondé con el *nombre del taller* y el *día*, y te contamos cómo inscribirte.' },
  {
    atajo: 'cupo', titulo: 'Taller sin cupo',
    texto: 'Ese taller ya completó su cupo. Podemos anotarte en la *lista de espera* y te avisamos por acá si se libera un lugar. ¿Te anotamos?\n\nTambién te podemos sugerir talleres parecidos que todavía tienen lugar.',
  },
  {
    atajo: 'pago', titulo: 'Aranceles 2027 y pago',
    texto:
      INSCRIPCION_2027 +
      '\n\n' +
      CUOTAS_2027 +
      '\n\nSe puede pagar [medios de pago].\n\nCuando pagues, mandanos por acá la *foto del comprobante* con tu nombre completo y el taller.',
  },
  { atajo: 'comprobante', titulo: 'Comprobante recibido', texto: '¡Gracias! Recibimos tu comprobante y lo registramos. Si hubiera algún problema, te avisamos por acá.' },
  { atajo: 'sede', titulo: 'Dónde estamos', texto: 'Estamos en [calle y número de la sede], Mendoza. Las aulas están numeradas; si es tu primera clase, preguntá en la entrada y te indicamos cuál es la tuya.' },
  { atajo: 'horario', titulo: 'Horario de atención', texto: `Respondemos consultas por este WhatsApp de ${HORARIO}. Fuera de ese horario dejanos tu mensaje y te contestamos apenas podamos.` },
  {
    atajo: 'ficha', titulo: 'Completar ficha',
    texto: 'Estamos actualizando las fichas de alumnos. ¿Nos pasás estos datos?\n1. Nombre completo\n2. DNI\n3. Mail\n4. Nombre y teléfono de un contacto de emergencia\n5. Obra social\n\nSon solo para uso interno del programa. ¡Gracias!',
  },
  {
    atajo: 'agendar', titulo: 'Pedir que agenden el número',
    texto: 'Para recibir los avisos de tu taller (cambios de aula, suspensiones y novedades) es importante que *agendes este número* en tu celular como "Aulas para el Tiempo Libre". Si no lo agendás, los avisos no te llegan.',
  },
  { atajo: 'suspension', titulo: 'Clase suspendida', texto: 'Te avisamos que la clase de *[taller]* del [día y fecha] queda *suspendida* por [motivo]. [La clase se recupera el ...]. Disculpá las molestias.' },
  {
    atajo: 'baja', titulo: 'Baja de un taller',
    texto: 'Lamentamos que no puedas seguir. Para registrar la baja, ¿nos confirmás tu nombre completo y de qué taller? Si es por algo que podamos mejorar, nos ayuda mucho que nos cuentes.',
  },
  { atajo: 'gracias', titulo: 'Despedida', texto: '¡Gracias por escribirnos! Cualquier otra consulta, estamos por acá. Que tengas un lindo día.' },
]

const PRESENTACION =
  '*Aulas para el Tiempo Libre - UNCuyo*\n\nHola, te escribimos desde el *nuevo WhatsApp oficial* de Aulas para el Tiempo Libre. A partir de ahora, por este número te vamos a informar inscripciones, horarios, cambios de aula y novedades de tu taller.\n\nTe pedimos dos cosas:\n1. *Agendá este número* como "Aulas para el Tiempo Libre".\n2. *Respondé este mensaje con un OK* para confirmar que te llegó.\n\n¡Gracias por ser parte!'

const COMUNICADOS: Texto[] = [
  {
    titulo: '1. Presentación del número oficial',
    donde: 'Uno por uno desde la pestaña "Listas por taller" (botón "Abrir chat"). Es el único que hay que mandar así: la difusión solo llega a quien ya agendó el número.',
    texto: PRESENTACION,
  },
  {
    titulo: '2. Canal oficial de novedades',
    donde: 'Después de crear el canal (pestaña Novedades → + → Nuevo canal). Mandarlo por difusión y fijarlo en el estado.',
    texto: 'Creamos el *canal oficial de Aulas para el Tiempo Libre* en WhatsApp. Ahí vamos a publicar las novedades generales: inscripciones, grilla de talleres, fechas importantes y actividades.\n\nPara seguirlo, tocá este enlace y después "Seguir":\n[enlace del canal]',
  },
  {
    titulo: '3. Inscripciones 2027',
    donde: 'Canal + listas de difusión. Mandar 3 o 4 días antes de abrir y repetir el día de apertura.',
    texto:
      '*Inscripciones 2027 - Aulas para el Tiempo Libre*\n\nYa podés elegir tus talleres para 2027.\n\n*Fechas:* del [fecha de inicio] al [fecha de cierre].\n*Cómo:* [en la sede de lunes a viernes de ... / en este link: ...].\n*Qué necesitás:* DNI y el nombre, día y horario del taller.\n' +
      INSCRIPCION_2027 +
      '\n\n' +
      CUOTAS_2027 +
      '\n\n*Medios de pago:* [medios de pago].\n\nLos cupos son limitados. Te compartimos la grilla completa en los próximos mensajes. Cualquier duda, escribinos por acá.',
  },
  {
    titulo: '5. Inicio de clases',
    donde: 'Listas de difusión por taller, una semana antes y el día anterior.',
    texto: '*¡Empiezan los talleres 2027!*\n\nLas clases comienzan el [día y fecha]. Revisá el día, el horario y el aula de tu taller; si es tu primera vez, preguntá en la entrada y te indicamos.\n\nTe esperamos. Cualquier consulta, escribinos por acá.',
  },
]

function Resaltado({ texto }: { texto: string }) {
  const partes = texto.split(/(\[[^\]]+\])/g)
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('[') ? (
          <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const area = document.createElement('textarea')
    area.value = texto
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

function BotonCopiar({ texto, etiqueta = 'Copiar' }: { texto: string; etiqueta?: string }) {
  const [hecho, setHecho] = useState(false)
  return (
    <button
      className="boton-suave py-1"
      onClick={async () => {
        await copiar(texto)
        setHecho(true)
        setTimeout(() => setHecho(false), 1500)
      }}
    >
      {hecho ? 'Copiado' : etiqueta}
    </button>
  )
}

function Bloque({ t }: { t: Texto }) {
  return (
    <div className="tarjeta p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-marca-800">
            {t.atajo && <span className="etiqueta bg-marca-100 text-marca-800 mr-2">/{t.atajo}</span>}
            {t.titulo}
          </p>
          {t.donde && <p className="text-xs text-slate-500">{t.donde}</p>}
        </div>
        <BotonCopiar texto={t.texto} />
      </div>
      <p className="text-sm whitespace-pre-wrap rounded-lg bg-[#e7f7dc] p-3"><Resaltado texto={t.texto} /></p>
    </div>
  )
}

function Ayuda({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-marca-100 bg-white p-3 text-sm text-slate-600 space-y-1">{children}</div>
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

const nombreAgenda = (c: Contacto) => `${c.nombre} ATL`

const escaparVcf = (v: string) => v.replace(/[\\,;]/g, (x) => `\\${x}`)

function vcf<C extends Contacto>(contactos: C[], etiquetas: (c: C) => string[]) {
  return contactos
    .filter((c) => c.celular)
    .map((c) =>
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${nombreAgenda(c)}`,
        `N:${nombreAgenda(c)};;;;`,
        `TEL;TYPE=CELL:+${c.celular}`,
        `CATEGORIES:${['ATL', ...etiquetas(c)].map(escaparVcf).join(',')}`,
        'END:VCARD',
      ].join('\r\n'),
    )
    .join('\r\n')
}

function csvGoogle(contactos: (Contacto & { etiquetas: string[] })[]) {
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`
  const filas = contactos
    .filter((c) => c.celular)
    .map((c) => [nombreAgenda(c), '', ['* myContacts', 'ATL', ...c.etiquetas].join(' ::: '), 'Mobile', `+${c.celular}`].map(celda).join(','))
  return ['First Name,Last Name,Labels,Phone 1 - Label,Phone 1 - Value', ...filas].join('\n')
}

const hora = (h: string) => h.replace(/^0/, '')

const enlaceChat = (celular: string, texto: string) => `https://wa.me/${celular}?text=${encodeURIComponent(texto)}`

function avisoTaller(t: Lista) {
  return `*Aulas para el Tiempo Libre*\n\nHola, te escribimos por el taller *${t.nombre}* (${t.dia_nombre.toLowerCase()} de ${hora(t.desde)} a ${hora(t.hasta)}${t.espacio ? `, ${t.espacio}` : ''}).\n\n[escribí acá el aviso]\n\nCualquier consulta, respondé este mensaje.`
}

function TallerLista({ t, enviados, marcar }: { t: Lista; enviados: Set<number>; marcar: (id: number) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<'presentacion' | 'aviso'>('presentacion')
  const [aviso, setAviso] = useState(avisoTaller(t))
  const conWa = t.alumnos.filter((a) => a.celular)
  const texto = modo === 'presentacion' ? PRESENTACION : aviso
  const listos = conWa.filter((a) => enviados.has(a.id)).length

  return (
    <div className="tarjeta">
      <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setAbierto(!abierto)}>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-marca-800 truncate">{t.nombre}</span>
          <span className="block text-xs text-slate-500">
            {t.dia_nombre} {t.desde}–{t.hasta} · {t.espacio || 'sin aula'} · {t.docente || 'sin docente'}
          </span>
        </span>
        <span className="text-right text-xs text-slate-500 shrink-0">
          <span className="block font-medium text-slate-700">{conWa.length} de {t.alumnos.length} con WhatsApp</span>
          {listos > 0 && <span className="block text-emerald-700">{listos} presentaciones enviadas</span>}
        </span>
      </button>
      {abierto && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={conWa.map(nombreAgenda).join('\n')} etiqueta="Copiar nombres (para armar la difusión)" />
            <button className="boton-suave py-1" onClick={() => descargar(`ATL ${t.dia_nombre} ${t.desde.replace(':', '.')} ${t.nombre}.vcf`, vcf(conWa, () => [t.etiqueta]), 'text/vcard')}>
              Descargar contactos del taller
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={modo === 'presentacion'} onChange={() => setModo('presentacion')} /> Presentación del número
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={modo === 'aviso'} onChange={() => setModo('aviso')} /> Aviso a este taller
            </label>
          </div>
          {modo === 'aviso' && <textarea className="campo" rows={7} value={aviso} onChange={(e) => setAviso(e.target.value)} />}
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            {t.alumnos.map((a) => (
              <div key={a.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{a.nombre}</span>
                  <span className="text-xs text-slate-400">{a.celular ? `+${a.celular}` : a.motivo + (a.telefono ? ` (${a.telefono})` : '')}</span>
                </span>
                {a.celular && (
                  <>
                    {modo === 'presentacion' && (
                      <label className="text-xs text-slate-500 flex items-center gap-1">
                        <input type="checkbox" checked={enviados.has(a.id)} onChange={() => marcar(a.id)} /> enviado
                      </label>
                    )}
                    <a
                      className="boton py-1"
                      href={enlaceChat(a.celular, texto)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => modo === 'presentacion' && !enviados.has(a.id) && marcar(a.id)}
                    >
                      Abrir chat
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const CLAVE_ENVIADOS = 'atl_wa_presentacion_enviada'

function ListasPorTaller() {
  const [periodo, setPeriodo] = useState('1C2026')
  const [datos, setDatos] = useState<Listas | null>(null)
  const [q, setQ] = useState('')
  const [enviados, setEnviados] = useState<Set<number>>(() => new Set(JSON.parse(localStorage.getItem(CLAVE_ENVIADOS) || '[]')))

  useEffect(() => {
    setDatos(null)
    api<Listas>(`/api/whatsapp/listas?periodo=${periodo}`).then(setDatos)
  }, [periodo])

  function marcar(id: number) {
    const nuevo = new Set(enviados)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    setEnviados(nuevo)
    localStorage.setItem(CLAVE_ENVIADOS, JSON.stringify([...nuevo]))
  }

  const filtrados = useMemo(() => {
    if (!datos) return []
    const b = q.trim().toLowerCase()
    return datos.talleres.filter((t) => t.alumnos.length && (!b || `${t.nombre} ${t.docente} ${t.dia_nombre}`.toLowerCase().includes(b)))
  }, [datos, q])

  const conWa = datos?.contactos.filter((c) => c.celular) ?? []
  const aRevisar = datos?.contactos.filter((c) => !c.celular) ?? []

  return (
    <div className="space-y-3">
      <Ayuda>
        <p><b>1. Cargar los contactos en el celular de ATL.</b> Descargá el archivo y abrilo desde ese celular (o importalo en contacts.google.com → Importar, con la cuenta de Google del celular). Quedan agendados como "Apellido Nombre ATL" y con una etiqueta por taller.</p>
        <p><b>2. Presentación del número.</b> Abrí cada taller, tocá "Abrir chat" y enviá. Hacelo en tandas de 50 a 80 por día para que WhatsApp no lo tome como spam. El tilde "enviado" queda guardado en esta computadora o celular.</p>
        <p><b>3. Listas de difusión por taller.</b> En WhatsApp Business: ⋮ → Nueva difusión → buscá cada nombre (botón "Copiar nombres") → ✓ → poné de nombre el del taller. Máximo 256 personas por lista. Solo reciben quienes agendaron el número.</p>
      </Ayuda>
      <div className="flex flex-wrap items-center gap-2">
        <select className="campo w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="1C2026">Alumnos 2026</option>
          <option value="2027">Talleres 2027</option>
        </select>
        <input className="campo flex-1 min-w-48" placeholder="Buscar taller, docente o día" value={q} onChange={(e) => setQ(e.target.value)} />
        {datos && (
          <>
            <button className="boton" onClick={() => descargar('Contactos ATL.vcf', vcf(conWa, (c) => c.etiquetas), 'text/vcard')}>Contactos (.vcf)</button>
            <button className="boton-suave" onClick={() => descargar('Contactos ATL Google.csv', csvGoogle(conWa), 'text/csv')}>Contactos para Google (.csv)</button>
          </>
        )}
      </div>
      {!datos && <p className="text-slate-500">Cargando…</p>}
      {datos && (
        <>
          <p className="text-sm text-slate-600">
            {conWa.length} alumnos con celular listo para WhatsApp · {aRevisar.length} teléfonos para revisar · {enviados.size} presentaciones enviadas
          </p>
          {filtrados.length === 0 && <p className="text-slate-500 text-sm">No hay talleres con alumnos inscriptos en este período.</p>}
          <div className="space-y-2">
            {filtrados.map((t) => (
              <TallerLista key={t.id} t={t} enviados={enviados} marcar={marcar} />
            ))}
          </div>
          {aRevisar.length > 0 && (
            <details className="tarjeta p-4">
              <summary className="cursor-pointer font-medium text-marca-800">Teléfonos para revisar ({aRevisar.length})</summary>
              <p className="text-xs text-slate-500 mt-2">Corregilos en Alumnos → ficha. Formato: característica + número, por ejemplo 2615123456.</p>
              <div className="mt-2 divide-y divide-slate-100 text-sm">
                {aRevisar.map((c) => (
                  <div key={c.id} className="py-1.5 flex gap-3">
                    <span className="flex-1">{c.nombre}</span>
                    <span className="text-slate-500">{c.telefono}</span>
                    <span className="text-xs text-amber-700 w-56 text-right">{c.motivo}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

const OTROS = 'Otros talleres'

function grillaPorArea(talleres: Taller[], conTentativos: boolean) {
  const vigentes = talleres.filter((t) => t.activo && t.estado !== 'No sigue' && (conTentativos || t.estado !== 'Tentativo'))
  const grupos = new Map<string, Taller[]>()
  for (const t of vigentes) {
    const area = t.area || OTROS
    grupos.set(area, [...(grupos.get(area) || []), t])
  }
  const orden = [...grupos.keys()].sort((a, b) => (a === OTROS ? 1 : b === OTROS ? -1 : a.localeCompare(b)))
  return orden.map((area) => ({
    titulo: `4. Grilla 2027 · ${area}`,
    texto: `*Talleres 2027 · ${area}*\n\n${grupos
      .get(area)!
      .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.dia - b.dia)
      .map((t) => `• *${t.nombre.trim()}*: ${t.dia_nombre.toLowerCase()} de ${hora(t.desde)} a ${hora(t.hasta)}${t.docente ? ` (${t.docente})` : ''}`)
      .join('\n')}\n\nPara inscribirte o consultar, respondé este mensaje.`,
  }))
}

function Comunicacion2027() {
  const [talleres, setTalleres] = useState<Taller[] | null>(null)
  const [conTentativos, setConTentativos] = useState(false)

  useEffect(() => {
    api<Taller[]>('/api/talleres?periodo=2027').then(setTalleres)
  }, [])

  const sinArea = talleres?.filter((t) => !t.area && t.estado !== 'No sigue').length ?? 0
  const tentativos = talleres?.filter((t) => t.estado === 'Tentativo').length ?? 0

  return (
    <div className="space-y-3">
      <Ayuda>
        <p><b>Orden sugerido:</b> 1) presentación del número uno por uno, 2) canal oficial, 3) inscripciones, 4) grilla por área, 5) inicio de clases.</p>
        <p>Lo marcado en amarillo hay que completarlo antes de mandar. Evitá nombrar otros programas o espacios: estos mensajes hablan solo de Aulas para el Tiempo Libre.</p>
        <p>Para que la gente escriba sola, el enlace directo es <b>wa.me/{NUMERO_ATL}</b> (sirve para carteles, mails y el canal).</p>
      </Ayuda>
      {COMUNICADOS.slice(0, 3).map((t) => <Bloque key={t.titulo} t={t} />)}
      <div className="tarjeta p-4 space-y-2">
        <p className="font-medium text-marca-800">4. Grilla 2027 por área</p>
        <p className="text-xs text-slate-500">
          Se arma sola con la planificación 2027 del panel. Mandar un mensaje por área, por el canal y por difusión.
          {sinArea > 0 && ` Hay ${sinArea} talleres 2027 sin área cargada: aparecen en "${OTROS}" hasta que se les ponga área en Talleres.`}
        </p>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={conTentativos} onChange={(e) => setConTentativos(e.target.checked)} /> Incluir los {tentativos} talleres tentativos
        </label>
      </div>
      {!talleres && <p className="text-slate-500">Cargando grilla…</p>}
      {talleres && grillaPorArea(talleres, conTentativos).map((t) => <Bloque key={t.titulo} t={t} />)}
      <Bloque t={COMUNICADOS[3]} />
    </div>
  )
}

const PESTANAS = ['Perfil y automáticos', 'Respuestas rápidas', 'Listas por taller', 'Comunicación 2027'] as const

export default function WhatsApp() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]>('Perfil y automáticos')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-marca-800">WhatsApp Business</h2>
        <p className="text-sm text-slate-500">Número oficial +54 9 2617 00-3923 · textos listos para copiar y pegar en la app</p>
      </div>
      <div className="flex flex-wrap gap-1">
        {PESTANAS.map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`rounded-lg px-3 py-1.5 text-sm ${pestana === p ? 'bg-marca-600 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {pestana === 'Perfil y automáticos' && (
        <div className="space-y-3">
          <Ayuda>
            <p>En el celular: abrí <b>WhatsApp Business → ⋮ (arriba a la derecha) → Herramientas para la empresa</b>. En iPhone: <b>Configuración → Herramientas para la empresa</b>.</p>
            <p>Lo marcado en amarillo hay que reemplazarlo por el dato real.</p>
          </Ayuda>
          {PERFIL.map((t) => <Bloque key={t.titulo} t={t} />)}
          {AUTOMATICOS.map((t) => <Bloque key={t.titulo} t={t} />)}
          <div className="tarjeta p-4 space-y-2">
            <p className="font-medium text-marca-800">Etiquetas para ordenar los chats</p>
            <p className="text-xs text-slate-500">
              Herramientas para la empresa → Etiquetas (o mantener apretado un chat → etiqueta). WhatsApp permite hasta 20, por eso los talleres van en listas de difusión y no en etiquetas.
            </p>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((e) => <span key={e} className="etiqueta bg-marca-100 text-marca-800">{e}</span>)}
            </div>
          </div>
        </div>
      )}

      {pestana === 'Respuestas rápidas' && (
        <div className="space-y-3">
          <Ayuda>
            <p><b>Herramientas para la empresa → Respuestas rápidas → +</b>. En "Atajo" poné la palabra (sin la barra) y en "Mensaje" pegá el texto.</p>
            <p>Para usarlas en un chat, escribí <b>/</b> y elegí la respuesta.</p>
          </Ayuda>
          {RAPIDAS.map((t) => <Bloque key={t.atajo} t={t} />)}
        </div>
      )}

      {pestana === 'Listas por taller' && <ListasPorTaller />}
      {pestana === 'Comunicación 2027' && <Comunicacion2027 />}
    </div>
  )
}
