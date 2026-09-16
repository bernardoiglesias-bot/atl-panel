"""Carga inicial con los datos reales del centro (backend/data/seed.json)."""
import json
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Alumno, Docente, Espacio, Inscripcion, Personal, Taller

SEED_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "seed.json")

AREAS = {
    "INGLÉS": "Idiomas", "FRANCÉS": "Idiomas", "ITALIANO": "Idiomas", "PORTUGUÉS": "Idiomas",
    "INGLES": "Idiomas", "CONVERSACIÓN": "Idiomas",
}


def cargar(db: Session) -> bool:
    """Carga los datos si la base está vacía. Devuelve True si cargó algo."""
    if db.scalar(select(Espacio).limit(1)):
        return False
    with open(SEED_FILE, encoding="utf-8") as f:
        data = json.load(f)

    espacios = {}
    for i, e in enumerate(data["espacios"]):
        obj = Espacio(nombre=e["nombre"], ubicacion=e["ubicacion"], capacidad=e["capacidad"], uso=e["uso"], orden=i)
        db.add(obj)
        espacios[e["nombre"]] = obj

    docentes = {}
    for d in data["docentes"]:
        obj = Docente(
            nombre=d["nombre"], dni=d["dni"], email=d["email"], celular=d["celular"], nacimiento=d["nacimiento"],
            facturacion=d["facturacion"], necesidades=d["necesidades"], maquinaria=d["maquinaria"],
            sugerencias=d["sugerencias"], cupo_min=d["cupo_min"], cupo_max=d["cupo_max"],
        )
        db.add(obj)
        docentes[d["nombre"]] = obj

    for p in data["personal"]:
        db.add(Personal(**p))

    talleres = []
    for t in data["talleres"]:
        obj = Taller(
            nombre=t["nombre"], dia=t["dia"], desde=t["desde"], hasta=t["hasta"], turno=t["turno"],
            espacio=espacios.get(t["espacio"] or ""), docente=docentes.get(t["docente_ficha"] or ""),
            docente_texto=t["docente"], estado=t["estado"], cupo_max=t["cupo_max"],
            observacion=t["observacion"], difusion=t["difusion"],
            activo=t["estado"] != "No se da",
        )
        db.add(obj)
        talleres.append(obj)

    alumnos = []
    for a in data["alumnos"]:
        obj = Alumno(nombre=a["nombre"], dni=a["dni"], email=a["email"], telefono=a["telefono"],
                     emergencia=a["emergencia"], obra_social=a["obra_social"])
        db.add(obj)
        alumnos.append(obj)

    for ins in data["inscripciones"]:
        taller = talleres[ins["taller_idx"]] if ins["taller_idx"] is not None else None
        db.add(Inscripcion(alumno=alumnos[ins["alumno_idx"]], taller=taller, taller_texto=ins["taller_texto"],
                           area=ins["area"], turno=ins["turno"]))
        if taller is not None and not taller.area:
            taller.area = ins["area"]

    db.commit()
    return True
