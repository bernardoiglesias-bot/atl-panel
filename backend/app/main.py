import os
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .db import DB_PATH, SessionLocal, get_db, init_db
from .models import (
    Alumno,
    Docente,
    Espacio,
    Evento,
    ExcepcionClase,
    Feedback,
    Gasto,
    Inscripcion,
    Objetivo,
    Personal,
    Seguimiento,
    Taller,
    Tarea,
    Usuario,
)
from .respaldo import arrancar as arrancar_respaldo
from .seed import cargar
from .seguridad import (
    HORAS_SESION,
    bloqueo_restante,
    clave_de_firma,
    clave_inicial,
    hash_clave,
    limpiar_intentos,
    registrar_fallo,
    verificar_clave,
)

signer = URLSafeTimedSerializer(clave_de_firma(os.path.dirname(os.path.abspath(DB_PATH))), salt="atl-login")
DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

app = FastAPI(title="ATL — Panel de gestión")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    db = SessionLocal()
    try:
        cargar(db)
        crear_usuario_inicial(db)
    finally:
        db.close()
    arrancar_respaldo()


# --------------------------------------------------------------- seguridad
def crear_usuario_inicial(db: Session) -> None:
    """Si todavía no hay nadie cargado, deja creado el primer acceso."""
    if db.scalar(select(Usuario).limit(1)):
        return
    clave = clave_inicial()
    db.add(Usuario(usuario="coordinacion", nombre="Coordinación", clave=hash_clave(clave)))
    db.commit()


def usuario(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.query_params.get("token", "")
    try:
        return signer.loads(token, max_age=60 * 60 * HORAS_SESION)
    except BadSignature:
        raise HTTPException(status_code=401, detail="Sesión no válida")


class LoginIn(BaseModel):
    nombre: str = ""
    password: str


class UsuarioIn(BaseModel):
    usuario: str
    nombre: str
    password: str


class ClaveIn(BaseModel):
    password_actual: str
    password_nueva: str


def usuario_out(u: Usuario):
    return {"id": u.id, "usuario": u.usuario, "nombre": u.nombre, "activo": u.activo,
            "creado": u.creado.isoformat(), "ultimo_ingreso": u.ultimo_ingreso.isoformat() if u.ultimo_ingreso else None}


def buscar_usuario(db: Session, nombre_usuario: str) -> Usuario | None:
    return db.scalar(select(Usuario).where(func.lower(Usuario.usuario) == nombre_usuario.lower()))


@app.post("/api/login")
def login(datos: LoginIn, request: Request, db: Session = Depends(get_db)):
    nombre_usuario = datos.nombre.strip()
    llave = f"{request.client.host if request.client else 'sin-ip'}|{nombre_usuario.lower()}"
    espera = bloqueo_restante(llave)
    if espera:
        raise HTTPException(429, f"Demasiados intentos fallidos. Probá de nuevo en {espera // 60 + 1} minutos")

    u = buscar_usuario(db, nombre_usuario)
    if not u or not u.activo or not verificar_clave(datos.password, u.clave):
        registrar_fallo(llave)
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    limpiar_intentos(llave)
    u.ultimo_ingreso = date.today()
    db.commit()
    return {"token": signer.dumps(u.usuario), "nombre": u.nombre, "usuario": u.usuario,
            "horas_sesion": HORAS_SESION}


@app.get("/api/usuarios")
def listar_usuarios(db: Session = Depends(get_db), _: str = Depends(usuario)):
    return [usuario_out(u) for u in db.scalars(select(Usuario).order_by(Usuario.nombre))]


@app.post("/api/usuarios")
def crear_usuario(datos: UsuarioIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    nombre_usuario = datos.usuario.strip().lower()
    if len(nombre_usuario) < 3:
        raise HTTPException(400, "El usuario necesita al menos 3 letras")
    if len(datos.password) < 8:
        raise HTTPException(400, "La contraseña necesita al menos 8 caracteres")
    if buscar_usuario(db, nombre_usuario):
        raise HTTPException(400, "Ya existe ese usuario")
    u = Usuario(usuario=nombre_usuario, nombre=datos.nombre.strip() or nombre_usuario, clave=hash_clave(datos.password))
    db.add(u)
    db.commit()
    return usuario_out(u)


@app.post("/api/usuarios/clave")
def cambiar_clave(datos: ClaveIn, db: Session = Depends(get_db), quien: str = Depends(usuario)):
    u = buscar_usuario(db, quien)
    if not u or not verificar_clave(datos.password_actual, u.clave):
        raise HTTPException(400, "La contraseña actual no coincide")
    if len(datos.password_nueva) < 8:
        raise HTTPException(400, "La contraseña nueva necesita al menos 8 caracteres")
    u.clave = hash_clave(datos.password_nueva)
    db.commit()
    return usuario_out(u)


@app.delete("/api/usuarios/{usuario_id}")
def desactivar_usuario(usuario_id: int, db: Session = Depends(get_db), quien: str = Depends(usuario)):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "No existe")
    if u.usuario == quien:
        raise HTTPException(400, "No podés desactivar tu propio acceso")
    u.activo = False
    db.commit()
    return usuario_out(u)


@app.get("/healthz")
def healthz():
    return {"ok": True}


# ------------------------------------------------------------ serializado
def esp_out(e: Espacio | None):
    return None if e is None else {"id": e.id, "nombre": e.nombre, "capacidad": e.capacidad,
                                   "ubicacion": e.ubicacion, "uso": e.uso, "activo": e.activo}


def taller_out(t: Taller, inscriptos: int | None = None):
    return {
        "id": t.id, "nombre": t.nombre, "area": t.area, "dia": t.dia, "dia_nombre": DIAS[t.dia],
        "desde": t.desde, "hasta": t.hasta, "turno": t.turno, "estado": t.estado, "cupo_max": t.cupo_max,
        "observacion": t.observacion, "difusion": t.difusion, "activo": t.activo,
        "espacio": esp_out(t.espacio), "espacio_id": t.espacio_id,
        "docente_id": t.docente_id, "docente": t.docente.nombre if t.docente else t.docente_texto,
        "docente_texto": t.docente_texto, "inscriptos": inscriptos,
    }


def alumno_out(a: Alumno, inscripciones=None):
    return {
        "id": a.id, "nombre": a.nombre, "dni": a.dni, "email": a.email, "telefono": a.telefono,
        "emergencia": a.emergencia, "obra_social": a.obra_social, "notas": a.notas,
        "ficha_completa": a.ficha_completa,
        "inscripciones": inscripciones if inscripciones is not None else [
            {"id": i.id, "taller_id": i.taller_id, "taller": i.taller.nombre if i.taller else i.taller_texto,
             "area": i.area, "turno": i.turno, "estado_pago": i.estado_pago,
             "dia_nombre": DIAS[i.taller.dia] if i.taller else "", "desde": i.taller.desde if i.taller else ""}
            for i in a.inscripciones
        ],
    }


def conteos(db: Session) -> dict[int, int]:
    filas = db.execute(
        select(Inscripcion.taller_id, func.count()).where(Inscripcion.taller_id.is_not(None))
        .group_by(Inscripcion.taller_id)
    ).all()
    return {t: c for t, c in filas}


# ----------------------------------------------------------------- agenda
@app.get("/api/agenda")
def agenda(fecha: str | None = None, db: Session = Depends(get_db), _: str = Depends(usuario)):
    f = date.fromisoformat(fecha) if fecha else date.today()
    dia = f.weekday()
    espacios = db.scalars(select(Espacio).where(Espacio.activo).order_by(Espacio.orden)).all()
    talleres = db.scalars(
        select(Taller).options(selectinload(Taller.espacio), selectinload(Taller.docente))
        .where(Taller.dia == dia, Taller.activo).order_by(Taller.desde)
    ).all()
    exc = {e.taller_id: e for e in db.scalars(select(ExcepcionClase).where(ExcepcionClase.fecha == f)).all()}
    insc = conteos(db)

    items = []
    for t in talleres:
        e = exc.get(t.id)
        if e and e.suspendida:
            items.append({"tipo": "suspendida", "id": t.id, "titulo": t.nombre, "desde": t.desde, "hasta": t.hasta,
                          "espacio": esp_out(t.espacio), "detalle": t.docente.nombre if t.docente else t.docente_texto,
                          "motivo": e.motivo, "inscriptos": insc.get(t.id, 0), "estado": t.estado})
            continue
        espacio = esp_out(e.espacio) if (e and e.espacio) else esp_out(t.espacio)
        items.append({"tipo": "clase", "id": t.id, "titulo": t.nombre, "desde": t.desde, "hasta": t.hasta,
                      "espacio": espacio, "detalle": t.docente.nombre if t.docente else t.docente_texto,
                      "motivo": e.motivo if e else "", "inscriptos": insc.get(t.id, 0), "estado": t.estado,
                      "cupo_max": t.cupo_max, "area": t.area})

    for ev in db.scalars(select(Evento).options(selectinload(Evento.espacio)).where(Evento.fecha == f)).all():
        items.append({"tipo": "evento", "id": ev.id, "titulo": ev.titulo, "desde": ev.desde, "hasta": ev.hasta,
                      "espacio": esp_out(ev.espacio), "detalle": ev.responsable, "subtipo": ev.tipo,
                      "motivo": ev.notas})

    items.sort(key=lambda i: (i["desde"], i["titulo"]))
    return {"fecha": f.isoformat(), "dia_nombre": DIAS[dia],
            "espacios": [esp_out(e) for e in espacios], "items": items}


@app.get("/api/agenda/semana")
def agenda_semana(desde: str | None = None, db: Session = Depends(get_db), u: str = Depends(usuario)):
    base = date.fromisoformat(desde) if desde else date.today()
    lunes = base - timedelta(days=base.weekday())
    return {"desde": lunes.isoformat(),
            "dias": [agenda((lunes + timedelta(days=i)).isoformat(), db, u) for i in range(6)]}


class EventoIn(BaseModel):
    titulo: str
    tipo: str = "Reunión"
    fecha: date
    desde: str = "09:00"
    hasta: str = "10:00"
    espacio_id: int | None = None
    responsable: str = ""
    notas: str = ""


@app.get("/api/eventos")
def eventos(desde: str | None = None, hasta: str | None = None, db: Session = Depends(get_db),
            _: str = Depends(usuario)):
    q = select(Evento).options(selectinload(Evento.espacio)).order_by(Evento.fecha, Evento.desde)
    if desde:
        q = q.where(Evento.fecha >= date.fromisoformat(desde))
    if hasta:
        q = q.where(Evento.fecha <= date.fromisoformat(hasta))
    return [{"id": e.id, "titulo": e.titulo, "tipo": e.tipo, "fecha": e.fecha.isoformat(), "desde": e.desde,
             "hasta": e.hasta, "espacio": esp_out(e.espacio), "espacio_id": e.espacio_id,
             "responsable": e.responsable, "notas": e.notas} for e in db.scalars(q).all()]


@app.post("/api/eventos")
def crear_evento(datos: EventoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    ev = Evento(**datos.model_dump())
    db.add(ev)
    db.commit()
    return {"id": ev.id}


@app.put("/api/eventos/{evento_id}")
def editar_evento(evento_id: int, datos: EventoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    ev = db.get(Evento, evento_id)
    if not ev:
        raise HTTPException(404, "No existe")
    for k, v in datos.model_dump().items():
        setattr(ev, k, v)
    db.commit()
    return {"id": ev.id}


@app.delete("/api/eventos/{evento_id}")
def borrar_evento(evento_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    ev = db.get(Evento, evento_id)
    if ev:
        db.delete(ev)
        db.commit()
    return {"ok": True}


class ExcepcionIn(BaseModel):
    taller_id: int
    fecha: date
    suspendida: bool = False
    espacio_id: int | None = None
    motivo: str = ""


@app.post("/api/excepciones")
def guardar_excepcion(datos: ExcepcionIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    exc = db.scalar(select(ExcepcionClase).where(ExcepcionClase.taller_id == datos.taller_id,
                                                 ExcepcionClase.fecha == datos.fecha))
    if not exc:
        exc = ExcepcionClase(taller_id=datos.taller_id, fecha=datos.fecha)
        db.add(exc)
    exc.suspendida = datos.suspendida
    exc.espacio_id = datos.espacio_id
    exc.motivo = datos.motivo
    db.commit()
    return {"id": exc.id}


# --------------------------------------------------------------- espacios
class EspacioIn(BaseModel):
    nombre: str
    ubicacion: str = ""
    capacidad: int | None = None
    uso: str = "Taller"
    activo: bool = True


@app.get("/api/espacios")
def listar_espacios(db: Session = Depends(get_db), _: str = Depends(usuario)):
    espacios = db.scalars(select(Espacio).order_by(Espacio.orden)).all()
    talleres = db.scalars(select(Taller).where(Taller.activo)).all()
    horas = {}
    for t in talleres:
        if t.espacio_id:
            horas[t.espacio_id] = horas.get(t.espacio_id, 0) + 1
    return [{**esp_out(e), "clases_semana": horas.get(e.id, 0)} for e in espacios]


@app.post("/api/espacios")
def crear_espacio(datos: EspacioIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    orden = (db.scalar(select(func.max(Espacio.orden))) or 0) + 1
    e = Espacio(**datos.model_dump(), orden=orden)
    db.add(e)
    db.commit()
    return esp_out(e)


@app.put("/api/espacios/{espacio_id}")
def editar_espacio(espacio_id: int, datos: EspacioIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    e = db.get(Espacio, espacio_id)
    if not e:
        raise HTTPException(404, "No existe")
    for k, v in datos.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return esp_out(e)


# --------------------------------------------------------------- talleres
class TallerIn(BaseModel):
    nombre: str
    area: str = ""
    dia: int
    desde: str
    hasta: str
    turno: str = ""
    espacio_id: int | None = None
    docente_id: int | None = None
    docente_texto: str = ""
    estado: str = "Con cupo"
    cupo_max: int | None = None
    observacion: str = ""
    difusion: str = ""
    activo: bool = True


@app.get("/api/talleres")
def listar_talleres(db: Session = Depends(get_db), _: str = Depends(usuario)):
    talleres = db.scalars(
        select(Taller).options(selectinload(Taller.espacio), selectinload(Taller.docente))
        .order_by(Taller.dia, Taller.desde, Taller.nombre)
    ).all()
    insc = conteos(db)
    return [taller_out(t, insc.get(t.id, 0)) for t in talleres]


@app.get("/api/talleres/{taller_id}")
def ver_taller(taller_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    t = db.get(Taller, taller_id)
    if not t:
        raise HTTPException(404, "No existe")
    alumnos = [{"id": i.alumno.id, "nombre": i.alumno.nombre, "dni": i.alumno.dni, "email": i.alumno.email,
                "telefono": i.alumno.telefono, "estado_pago": i.estado_pago, "inscripcion_id": i.id}
               for i in sorted(t.inscripciones, key=lambda i: i.alumno.nombre)]
    return {**taller_out(t, len(alumnos)), "alumnos": alumnos}


@app.post("/api/talleres")
def crear_taller(datos: TallerIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    t = Taller(**datos.model_dump())
    db.add(t)
    db.commit()
    return taller_out(t, 0)


@app.put("/api/talleres/{taller_id}")
def editar_taller(taller_id: int, datos: TallerIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    t = db.get(Taller, taller_id)
    if not t:
        raise HTTPException(404, "No existe")
    for k, v in datos.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return taller_out(t)


# --------------------------------------------------------------- docentes
class DocenteIn(BaseModel):
    nombre: str
    dni: str = ""
    email: str = ""
    celular: str = ""
    nacimiento: str = ""
    facturacion: str = ""
    necesidades: str = ""
    maquinaria: str = ""
    sugerencias: str = ""
    cupo_min: str = ""
    cupo_max: str = ""


@app.get("/api/docentes")
def listar_docentes(db: Session = Depends(get_db), _: str = Depends(usuario)):
    docentes = db.scalars(select(Docente).options(selectinload(Docente.talleres)).order_by(Docente.nombre)).all()
    return [{
        "id": d.id, "nombre": d.nombre, "dni": d.dni, "email": d.email, "celular": d.celular,
        "nacimiento": d.nacimiento, "facturacion": d.facturacion, "necesidades": d.necesidades,
        "maquinaria": d.maquinaria, "sugerencias": d.sugerencias, "cupo_min": d.cupo_min, "cupo_max": d.cupo_max,
        "talleres": [{"id": t.id, "nombre": t.nombre, "dia_nombre": DIAS[t.dia], "desde": t.desde, "hasta": t.hasta,
                      "espacio": t.espacio.nombre if t.espacio else ""} for t in
                     sorted(d.talleres, key=lambda t: (t.dia, t.desde))],
    } for d in docentes]


@app.put("/api/docentes/{docente_id}")
def editar_docente(docente_id: int, datos: DocenteIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    d = db.get(Docente, docente_id)
    if not d:
        raise HTTPException(404, "No existe")
    for k, v in datos.model_dump().items():
        setattr(d, k, v)
    db.commit()
    return {"id": d.id}


@app.get("/api/personal")
def listar_personal(db: Session = Depends(get_db), _: str = Depends(usuario)):
    return [{"id": p.id, "nombre": p.nombre, "funcion": p.funcion, "email": p.email, "telefono": p.telefono}
            for p in db.scalars(select(Personal).order_by(Personal.funcion, Personal.nombre)).all()]


# ---------------------------------------------------------------- alumnos
class AlumnoIn(BaseModel):
    nombre: str
    dni: str = ""
    email: str = ""
    telefono: str = ""
    emergencia: str = ""
    obra_social: str = ""
    notas: str = ""


@app.get("/api/alumnos")
def listar_alumnos(q: str = "", solo_incompletos: bool = False, taller_id: int | None = None,
                   pagina: int = 1, por_pagina: int = 50,
                   db: Session = Depends(get_db), _: str = Depends(usuario)):
    consulta = select(Alumno).options(selectinload(Alumno.inscripciones).selectinload(Inscripcion.taller))
    if q:
        patron = f"%{q.strip()}%"
        consulta = consulta.where(Alumno.nombre.ilike(patron) | Alumno.dni.ilike(patron) | Alumno.email.ilike(patron))
    if taller_id:
        consulta = consulta.join(Inscripcion).where(Inscripcion.taller_id == taller_id)
    alumnos = db.scalars(consulta.order_by(Alumno.nombre)).unique().all()
    if solo_incompletos:
        alumnos = [a for a in alumnos if not a.ficha_completa]
    total = len(alumnos)
    inicio = (pagina - 1) * por_pagina
    return {"total": total, "pagina": pagina, "por_pagina": por_pagina,
            "alumnos": [alumno_out(a) for a in alumnos[inicio:inicio + por_pagina]]}


@app.put("/api/alumnos/{alumno_id}")
def editar_alumno(alumno_id: int, datos: AlumnoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    a = db.get(Alumno, alumno_id)
    if not a:
        raise HTTPException(404, "No existe")
    for k, v in datos.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return alumno_out(a)


class PagoIn(BaseModel):
    estado_pago: str


@app.put("/api/inscripciones/{inscripcion_id}/pago")
def cambiar_pago(inscripcion_id: int, datos: PagoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    i = db.get(Inscripcion, inscripcion_id)
    if not i:
        raise HTTPException(404, "No existe")
    i.estado_pago = datos.estado_pago
    db.commit()
    return {"id": i.id, "estado_pago": i.estado_pago}


class AsignarTallerIn(BaseModel):
    taller_id: int


@app.get("/api/inscripciones/sin-taller")
def inscripciones_sin_taller(db: Session = Depends(get_db), _: str = Depends(usuario)):
    filas = db.scalars(
        select(Inscripcion).options(selectinload(Inscripcion.alumno)).where(Inscripcion.taller_id.is_(None))
    ).all()
    return [{"id": i.id, "alumno": i.alumno.nombre, "taller_texto": i.taller_texto, "area": i.area, "turno": i.turno}
            for i in filas]


@app.put("/api/inscripciones/{inscripcion_id}/taller")
def asignar_taller(inscripcion_id: int, datos: AsignarTallerIn, db: Session = Depends(get_db),
                   _: str = Depends(usuario)):
    i = db.get(Inscripcion, inscripcion_id)
    if not i:
        raise HTTPException(404, "No existe")
    i.taller_id = datos.taller_id
    db.commit()
    return {"id": i.id}


# ----------------------------------------------------------------- tareas
PLAZOS = ["Urgente", "Corto", "Mediano", "Largo"]


class TareaIn(BaseModel):
    titulo: str
    detalle: str = ""
    plazo: str = "Corto"
    estado: str = "Pendiente"
    responsable: str = ""
    area: str = ""
    espacio_id: int | None = None
    vence: date | None = None
    objetivo_id: int | None = None


def tarea_out(t: Tarea):
    return {"id": t.id, "titulo": t.titulo, "detalle": t.detalle, "plazo": t.plazo, "estado": t.estado,
            "responsable": t.responsable, "area": t.area, "espacio_id": t.espacio_id,
            "espacio": t.espacio.nombre if t.espacio else "", "objetivo_id": t.objetivo_id,
            "objetivo": t.objetivo.titulo if t.objetivo else "",
            "vence": t.vence.isoformat() if t.vence else None, "creada": t.creada.isoformat() if t.creada else None,
            "cerrada": t.cerrada.isoformat() if t.cerrada else None, "vencida": t.vencida}


@app.get("/api/tareas")
def listar_tareas(estado: str = "", plazo: str = "", db: Session = Depends(get_db), _: str = Depends(usuario)):
    q = select(Tarea).options(selectinload(Tarea.espacio), selectinload(Tarea.objetivo))
    if estado:
        q = q.where(Tarea.estado == estado)
    if plazo:
        q = q.where(Tarea.plazo == plazo)
    tareas = db.scalars(q).all()
    orden = {p: i for i, p in enumerate(PLAZOS)}
    tareas.sort(key=lambda t: (t.estado == "Hecha", orden.get(t.plazo, 9), t.vence or date.max))
    return [tarea_out(t) for t in tareas]


@app.post("/api/tareas")
def crear_tarea(datos: TareaIn, db: Session = Depends(get_db), u: str = Depends(usuario)):
    t = Tarea(**datos.model_dump(), creada=date.today())
    if not t.responsable:
        t.responsable = u
    db.add(t)
    db.commit()
    return tarea_out(t)


@app.put("/api/tareas/{tarea_id}")
def editar_tarea(tarea_id: int, datos: TareaIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    t = db.get(Tarea, tarea_id)
    if not t:
        raise HTTPException(404, "No existe")
    t.titulo = datos.titulo
    t.detalle = datos.detalle
    t.plazo = datos.plazo
    t.estado = datos.estado
    t.responsable = datos.responsable
    t.area = datos.area
    t.espacio_id = datos.espacio_id
    t.vence = datos.vence
    t.objetivo_id = datos.objetivo_id
    t.cerrada = date.today() if t.estado == "Hecha" and not t.cerrada else (None if t.estado != "Hecha" else t.cerrada)
    db.commit()
    return tarea_out(t)


@app.delete("/api/tareas/{tarea_id}")
def borrar_tarea(tarea_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    t = db.get(Tarea, tarea_id)
    if t:
        db.delete(t)
        db.commit()
    return {"ok": True}


# ------------------------------------------------------------------ gastos
ETAPAS = ["Necesidad", "Presupuestado", "Adelanto pedido", "Adelanto recibido", "Rendido", "Rechazado"]


class GastoIn(BaseModel):
    concepto: str
    detalle: str = ""
    rubro: str = ""
    etapa: str = "Necesidad"
    monto_presupuestado: float | None = None
    monto_adelanto: float | None = None
    monto_rendido: float | None = None
    proveedor: str = ""
    solicitante: str = ""
    espacio_id: int | None = None
    fecha_necesidad: date | None = None
    notas: str = ""


def gasto_out(g: Gasto):
    return {"id": g.id, "concepto": g.concepto, "detalle": g.detalle, "rubro": g.rubro, "etapa": g.etapa,
            "monto_presupuestado": g.monto_presupuestado, "monto_adelanto": g.monto_adelanto,
            "monto_rendido": g.monto_rendido, "proveedor": g.proveedor, "solicitante": g.solicitante,
            "espacio_id": g.espacio_id, "espacio": g.espacio.nombre if g.espacio else "",
            "fecha": g.fecha.isoformat() if g.fecha else None,
            "fecha_necesidad": g.fecha_necesidad.isoformat() if g.fecha_necesidad else None,
            "notas": g.notas, "pendiente_rendir": g.pendiente_rendir}


@app.get("/api/gastos")
def listar_gastos(etapa: str = "", db: Session = Depends(get_db), _: str = Depends(usuario)):
    q = select(Gasto).options(selectinload(Gasto.espacio)).order_by(Gasto.fecha.desc(), Gasto.id.desc())
    if etapa:
        q = q.where(Gasto.etapa == etapa)
    gastos = db.scalars(q).all()
    return {
        "gastos": [gasto_out(g) for g in gastos],
        "totales": {
            "presupuestado": round(sum(g.monto_presupuestado or 0 for g in gastos), 2),
            "adelantado": round(sum(g.monto_adelanto or 0 for g in gastos), 2),
            "rendido": round(sum(g.monto_rendido or 0 for g in gastos), 2),
            "pendiente_rendir": round(sum(g.pendiente_rendir for g in gastos), 2),
        },
        "por_etapa": {e: len([g for g in gastos if g.etapa == e]) for e in ETAPAS},
    }


@app.post("/api/gastos")
def crear_gasto(datos: GastoIn, db: Session = Depends(get_db), u: str = Depends(usuario)):
    g = Gasto(**datos.model_dump(), fecha=date.today())
    if not g.solicitante:
        g.solicitante = u
    db.add(g)
    db.commit()
    return gasto_out(g)


@app.put("/api/gastos/{gasto_id}")
def editar_gasto(gasto_id: int, datos: GastoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    g = db.get(Gasto, gasto_id)
    if not g:
        raise HTTPException(404, "No existe")
    g.concepto = datos.concepto
    g.detalle = datos.detalle
    g.rubro = datos.rubro
    g.etapa = datos.etapa
    g.monto_presupuestado = datos.monto_presupuestado
    g.monto_adelanto = datos.monto_adelanto
    g.monto_rendido = datos.monto_rendido
    g.proveedor = datos.proveedor
    g.solicitante = datos.solicitante
    g.espacio_id = datos.espacio_id
    g.fecha_necesidad = datos.fecha_necesidad
    g.notas = datos.notas
    db.commit()
    return gasto_out(g)


@app.delete("/api/gastos/{gasto_id}")
def borrar_gasto(gasto_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    g = db.get(Gasto, gasto_id)
    if g:
        db.delete(g)
        db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- feedback
class FeedbackIn(BaseModel):
    fecha: date | None = None
    docente_id: int | None = None
    personal_id: int | None = None
    persona_texto: str = ""
    tipo: str = "Seguimiento"
    valoracion: int | None = None
    tema: str = ""
    comentario: str = ""
    acuerdos: str = ""


def feedback_out(f: Feedback):
    persona = f.docente.nombre if f.docente else (f.personal.nombre if f.personal else f.persona_texto)
    return {"id": f.id, "fecha": f.fecha.isoformat() if f.fecha else None, "docente_id": f.docente_id,
            "personal_id": f.personal_id, "persona_texto": f.persona_texto, "persona": persona,
            "rol": "Docente" if f.docente_id else ("Personal" if f.personal_id else ""),
            "tipo": f.tipo, "valoracion": f.valoracion, "tema": f.tema, "comentario": f.comentario,
            "acuerdos": f.acuerdos, "registrado_por": f.registrado_por}


@app.get("/api/feedback")
def listar_feedback(docente_id: int | None = None, db: Session = Depends(get_db), _: str = Depends(usuario)):
    q = select(Feedback).options(selectinload(Feedback.docente), selectinload(Feedback.personal))
    if docente_id:
        q = q.where(Feedback.docente_id == docente_id)
    filas = db.scalars(q.order_by(Feedback.fecha.desc(), Feedback.id.desc())).all()
    return [feedback_out(f) for f in filas]


@app.post("/api/feedback")
def crear_feedback(datos: FeedbackIn, db: Session = Depends(get_db), u: str = Depends(usuario)):
    cuerpo = datos.model_dump()
    cuerpo["fecha"] = cuerpo["fecha"] or date.today()
    f = Feedback(**cuerpo, registrado_por=u)
    db.add(f)
    db.commit()
    return feedback_out(f)


@app.put("/api/feedback/{feedback_id}")
def editar_feedback(feedback_id: int, datos: FeedbackIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    f = db.get(Feedback, feedback_id)
    if not f:
        raise HTTPException(404, "No existe")
    f.fecha = datos.fecha or f.fecha
    f.docente_id = datos.docente_id
    f.personal_id = datos.personal_id
    f.persona_texto = datos.persona_texto
    f.tipo = datos.tipo
    f.valoracion = datos.valoracion
    f.tema = datos.tema
    f.comentario = datos.comentario
    f.acuerdos = datos.acuerdos
    db.commit()
    return feedback_out(f)


@app.delete("/api/feedback/{feedback_id}")
def borrar_feedback(feedback_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    f = db.get(Feedback, feedback_id)
    if f:
        db.delete(f)
        db.commit()
    return {"ok": True}


# --------------------------------------------------------------- objetivos
def valor_indicador(nombre: str, db: Session) -> float | None:
    """Indicadores que se calculan solos con los datos del sistema."""
    alumnos = db.scalars(select(Alumno)).all()
    if nombre == "fichas_completas_pct":
        return round(100 * sum(1 for a in alumnos if a.ficha_completa) / len(alumnos), 1) if alumnos else None
    if nombre == "inscripciones":
        return float(db.scalar(select(func.count()).select_from(Inscripcion)) or 0)
    if nombre == "alumnos":
        return float(len(alumnos))
    if nombre == "inscripciones_sin_taller":
        return float(db.scalar(
            select(func.count()).select_from(Inscripcion).where(Inscripcion.taller_id.is_(None))) or 0)
    if nombre == "talleres_activos":
        return float(db.scalar(select(func.count()).select_from(Taller).where(Taller.activo)) or 0)
    if nombre == "talleres_bajos":
        insc = conteos(db)
        return float(len([t for t in db.scalars(select(Taller).where(Taller.activo)).all()
                          if insc.get(t.id, 0) <= 3]))
    if nombre == "tareas_vencidas":
        return float(len([t for t in db.scalars(select(Tarea)).all() if t.vencida]))
    if nombre == "gastos_pendientes_rendir":
        return round(sum(g.pendiente_rendir for g in db.scalars(select(Gasto)).all()), 2)
    if nombre == "feedback_registrados":
        return float(db.scalar(select(func.count()).select_from(Feedback)) or 0)
    return None


INDICADORES = [
    ("manual", "Lo cargamos a mano"),
    ("fichas_completas_pct", "% de fichas de alumno completas"),
    ("alumnos", "Cantidad de alumnos"),
    ("inscripciones", "Cantidad de inscripciones"),
    ("inscripciones_sin_taller", "Inscripciones sin taller asignado"),
    ("talleres_activos", "Talleres activos"),
    ("talleres_bajos", "Talleres con 3 inscriptos o menos"),
    ("tareas_vencidas", "Tareas vencidas"),
    ("gastos_pendientes_rendir", "Adelantos pendientes de rendir"),
    ("feedback_registrados", "Devoluciones registradas"),
]


class ObjetivoIn(BaseModel):
    titulo: str
    detalle: str = ""
    responsable: str = ""
    indicador: str = "manual"
    unidad: str = ""
    valor_inicial: float | None = None
    valor_meta: float | None = None
    valor_actual: float | None = None
    vence: date | None = None
    estado: str = "En curso"


class SeguimientoIn(BaseModel):
    fecha: date | None = None
    valor: float | None = None
    comentario: str = ""


def objetivo_out(o: Objetivo, db: Session):
    actual = valor_indicador(o.indicador, db) if o.indicador != "manual" else o.valor_actual
    inicial, meta = o.valor_inicial, o.valor_meta
    avance = None
    if actual is not None and meta is not None and inicial is not None and meta != inicial:
        avance = max(0, min(100, round(100 * (actual - inicial) / (meta - inicial))))
    return {"id": o.id, "titulo": o.titulo, "detalle": o.detalle, "responsable": o.responsable,
            "indicador": o.indicador, "unidad": o.unidad, "valor_inicial": inicial, "valor_meta": meta,
            "valor_actual": actual, "avance": avance, "estado": o.estado,
            "vence": o.vence.isoformat() if o.vence else None,
            "automatico": o.indicador != "manual",
            "tareas": [{"id": t.id, "titulo": t.titulo, "estado": t.estado, "plazo": t.plazo} for t in o.tareas],
            "seguimientos": [{"id": s.id, "fecha": s.fecha.isoformat(), "valor": s.valor,
                              "comentario": s.comentario}
                             for s in sorted(o.seguimientos, key=lambda s: s.fecha, reverse=True)]}


@app.get("/api/indicadores")
def listar_indicadores(db: Session = Depends(get_db), _: str = Depends(usuario)):
    return [{"clave": c, "texto": t, "valor": valor_indicador(c, db)} for c, t in INDICADORES]


@app.get("/api/objetivos")
def listar_objetivos(db: Session = Depends(get_db), _: str = Depends(usuario)):
    objetivos = db.scalars(
        select(Objetivo).options(selectinload(Objetivo.tareas), selectinload(Objetivo.seguimientos))
        .order_by(Objetivo.estado, Objetivo.vence)
    ).all()
    return [objetivo_out(o, db) for o in objetivos]


@app.post("/api/objetivos")
def crear_objetivo(datos: ObjetivoIn, db: Session = Depends(get_db), u: str = Depends(usuario)):
    o = Objetivo(**datos.model_dump())
    if not o.responsable:
        o.responsable = u
    if o.indicador != "manual" and o.valor_inicial is None:
        o.valor_inicial = valor_indicador(o.indicador, db)
    db.add(o)
    db.commit()
    return objetivo_out(o, db)


@app.put("/api/objetivos/{objetivo_id}")
def editar_objetivo(objetivo_id: int, datos: ObjetivoIn, db: Session = Depends(get_db), _: str = Depends(usuario)):
    o = db.get(Objetivo, objetivo_id)
    if not o:
        raise HTTPException(404, "No existe")
    o.titulo = datos.titulo
    o.detalle = datos.detalle
    o.responsable = datos.responsable
    o.indicador = datos.indicador
    o.unidad = datos.unidad
    o.valor_inicial = datos.valor_inicial
    o.valor_meta = datos.valor_meta
    o.valor_actual = datos.valor_actual
    o.vence = datos.vence
    o.estado = datos.estado
    db.commit()
    return objetivo_out(o, db)


@app.delete("/api/objetivos/{objetivo_id}")
def borrar_objetivo(objetivo_id: int, db: Session = Depends(get_db), _: str = Depends(usuario)):
    o = db.get(Objetivo, objetivo_id)
    if o:
        db.delete(o)
        db.commit()
    return {"ok": True}


@app.post("/api/objetivos/{objetivo_id}/seguimientos")
def crear_seguimiento(objetivo_id: int, datos: SeguimientoIn, db: Session = Depends(get_db),
                      _: str = Depends(usuario)):
    o = db.get(Objetivo, objetivo_id)
    if not o:
        raise HTTPException(404, "No existe")
    s = Seguimiento(objetivo_id=objetivo_id, fecha=datos.fecha or date.today(), valor=datos.valor,
                    comentario=datos.comentario)
    db.add(s)
    if datos.valor is not None and o.indicador == "manual":
        o.valor_actual = datos.valor
    db.commit()
    return objetivo_out(o, db)


# ---------------------------------------------------------------- resumen
@app.get("/api/resumen")
def resumen(db: Session = Depends(get_db), _: str = Depends(usuario)):
    talleres = db.scalars(select(Taller).options(selectinload(Taller.espacio)).where(Taller.activo)).all()
    insc = conteos(db)
    alumnos = db.scalars(select(Alumno)).all()
    completas = sum(1 for a in alumnos if a.ficha_completa)
    total_insc = db.scalar(select(func.count()).select_from(Inscripcion)) or 0
    multi = db.scalar(
        select(func.count()).select_from(
            select(Inscripcion.alumno_id).group_by(Inscripcion.alumno_id).having(func.count() > 1).subquery()
        )
    ) or 0

    por_area: dict[str, int] = {}
    for i in db.execute(select(Inscripcion.area, func.count()).group_by(Inscripcion.area)).all():
        por_area[i[0] or "Sin área"] = i[1]

    ocupacion = []
    for e in db.scalars(select(Espacio).where(Espacio.activo).order_by(Espacio.orden)).all():
        clases = [t for t in talleres if t.espacio_id == e.id]
        ocupacion.append({"espacio": e.nombre, "clases": len(clases), "capacidad": e.capacidad})

    llenos = [taller_out(t, insc.get(t.id, 0)) for t in talleres
              if t.cupo_max and insc.get(t.id, 0) >= t.cupo_max]
    bajos = [taller_out(t, insc.get(t.id, 0)) for t in talleres if insc.get(t.id, 0) <= 3]

    return {
        "periodo": "1º cuatrimestre 2026",
        "talleres": len(talleres),
        "alumnos": len(alumnos),
        "inscripciones": total_insc,
        "inscripciones_sin_taller": db.scalar(
            select(func.count()).select_from(Inscripcion).where(Inscripcion.taller_id.is_(None))) or 0,
        "docentes": db.scalar(select(func.count()).select_from(Docente)) or 0,
        "espacios": db.scalar(select(func.count()).select_from(Espacio)) or 0,
        "fichas_completas": completas,
        "fichas_completas_pct": round(100 * completas / len(alumnos)) if alumnos else 0,
        "alumnos_multi_taller": multi,
        "por_area": sorted(por_area.items(), key=lambda x: -x[1]),
        "ocupacion": ocupacion,
        "talleres_llenos": llenos,
        "talleres_bajos": bajos,
        "tareas": {
            "pendientes": db.scalar(
                select(func.count()).select_from(Tarea).where(Tarea.estado != "Hecha")) or 0,
            "urgentes": db.scalar(select(func.count()).select_from(Tarea)
                                  .where(Tarea.estado != "Hecha", Tarea.plazo == "Urgente")) or 0,
            "vencidas": len([t for t in db.scalars(select(Tarea)).all() if t.vencida]),
        },
        "gastos": {
            "pendiente_rendir": round(sum(g.pendiente_rendir for g in db.scalars(select(Gasto)).all()), 2),
            "a_resolver": db.scalar(select(func.count()).select_from(Gasto)
                                    .where(Gasto.etapa.in_(["Necesidad", "Presupuestado",
                                                            "Adelanto pedido"]))) or 0,
        },
        "objetivos_en_curso": db.scalar(
            select(func.count()).select_from(Objetivo).where(Objetivo.estado == "En curso")) or 0,
        "feedback_registrados": db.scalar(select(func.count()).select_from(Feedback)) or 0,
        "hoy": {"fecha": date.today().isoformat(), "dia_nombre": DIAS[date.today().weekday()],
                "clases": len([t for t in talleres if t.dia == date.today().weekday()])},
        "actualizado": datetime.now().isoformat(timespec="seconds"),
    }


# ------------------------------------------------------------ panel web
WEB = os.environ.get("ATL_WEB_DIR", os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "web"))

if os.path.isdir(WEB):
    app.mount("/assets", StaticFiles(directory=os.path.join(WEB, "assets")), name="assets")

    @app.get("/{resto:path}")
    def panel(resto: str):
        archivo = os.path.join(WEB, resto)
        if resto and os.path.isfile(archivo):
            return FileResponse(archivo)
        return FileResponse(os.path.join(WEB, "index.html"))
