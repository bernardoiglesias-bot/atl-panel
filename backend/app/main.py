import os
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .db import SessionLocal, get_db, init_db
from .models import Alumno, Docente, Espacio, Evento, ExcepcionClase, Inscripcion, Personal, Taller
from .seed import cargar

PASSWORD = os.environ.get("ATL_PASSWORD", "atl2026")
SECRET = os.environ.get("ATL_SECRET", "atl-clave-de-firma-local")
signer = URLSafeTimedSerializer(SECRET, salt="atl-login")
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
    finally:
        db.close()


# --------------------------------------------------------------- seguridad
def usuario(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else request.query_params.get("token", "")
    try:
        return signer.loads(token, max_age=60 * 60 * 24 * 30)
    except BadSignature:
        raise HTTPException(status_code=401, detail="Sesión no válida")


class LoginIn(BaseModel):
    nombre: str = ""
    password: str


@app.post("/api/login")
def login(datos: LoginIn):
    if datos.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    nombre = datos.nombre.strip() or "Coordinación"
    return {"token": signer.dumps(nombre), "nombre": nombre}


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
        "hoy": {"fecha": date.today().isoformat(), "dia_nombre": DIAS[date.today().weekday()],
                "clases": len([t for t in talleres if t.dia == date.today().weekday()])},
        "actualizado": datetime.now().isoformat(timespec="seconds"),
    }
