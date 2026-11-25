"""Sincroniza alumnos e inscripciones desde la planilla "Alumnos por Turno-Taller-Día y Horario".

La planilla es la fuente de verdad del cuatrimestre: se agregan alumnos e inscripciones nuevas,
se completan datos de contacto, y se dan de baja las inscripciones que ya no figuran.
Las personas nunca se borran (conservan notas y estado de pago de lo que sigue vigente).
"""
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from io import BytesIO

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .models import PERIODO_ACTUAL, Alumno, Inscripcion, Taller

DIA_IDX = {'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5}
HORA = re.compile(r'(\d{1,2})[:.]?(\d{2})?\s*(?:HS|H)?')
VACIAS = {'TALLER', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'EN', 'PARA', 'CON', 'POR', 'A',
          'NIVEL', 'NUEVO', 'CUATRIMESTRAL', 'CONFIRMADO', 'UNICO'}
CHICAS = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a', 'al', 'por'}


def norm(s) -> str:
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.sub(r'[^A-Z0-9 ]', ' ', s).split())


def titulo(s) -> str:
    s = ' '.join(str(s or '').split())
    if s.isupper() or s.islower():
        s = ' '.join(w if i and w in CHICAS else w.capitalize() for i, w in enumerate(s.lower().split()))
    return s


def txt(v) -> str:
    if v is None:
        return ''
    s = str(v).strip()
    return s[:-2] if s.endswith('.0') and s[:-2].isdigit() else s


def toks(s):
    t = {w for w in norm(s).split() if w not in VACIAS}
    return t or set(norm(s).split())


def similitud(a, b):
    ta, tb = toks(a), toks(b)
    contencion = len(ta & tb) / max(min(len(ta), len(tb)), 1)
    return max(SequenceMatcher(None, norm(a), norm(b)).ratio(), contencion)


def misma_persona(a, b):
    ta, tb = set(norm(a).split()), set(norm(b).split())
    if ta <= tb or tb <= ta:
        return True
    return SequenceMatcher(None, norm(a), norm(b)).ratio() >= 0.75


def buscar_taller(talleres: list[Taller], nombre: str, dia_hora: str) -> Taller | None:
    dh = norm(dia_hora)
    dia = next((DIA_IDX[d] for d in DIA_IDX if d in dh), None)
    m = HORA.search(dh.split(' ', 1)[-1] if dia is not None else dh)
    hora = int(m.group(1)) if m else None
    mejor, mejor_score, mejor_sim = None, 0.0, 0.0
    for t in talleres:
        sim = similitud(nombre, t.nombre)
        if sim < 0.45:
            continue
        score = 0.6 * sim
        if dia is not None and t.dia == dia:
            score += 0.25
        if hora is not None and int(t.desde[:2]) == hora:
            score += 0.15
        if t.activo:
            score += 0.01
        if score > mejor_score:
            mejor, mejor_score, mejor_sim = t, score, sim
    if mejor is not None and (mejor_score >= 0.75 or mejor_sim >= 0.9):
        return mejor
    return None


def leer_planilla(contenido: bytes):
    """Devuelve personas (dict) con sus inscripciones, ya unificadas dentro de la planilla."""
    wb = load_workbook(BytesIO(contenido), data_only=True, read_only=True)
    personas: list[dict] = []
    por_dni: dict[str, dict] = {}
    por_nombre: dict[str, dict] = {}
    repetidas = 0
    dni_dudosos: set[str] = set()
    for ws in wb.worksheets:
        area, _, turno = ws.title.rpartition(' ')
        header = False
        for r in ws.iter_rows(values_only=True):
            vals = [txt(v) for v in r] + [''] * 9
            if not any(vals):
                continue
            if not header:
                if norm(vals[0]) == 'TALLER' or norm(vals[1]).startswith('NOMBRE'):
                    header = True
                continue
            taller, nombre = vals[0].strip(), ' '.join(vals[1].replace(',', ' ').split())
            if not nombre or not taller:
                continue
            dni, mail, contacto, emergencia, obra = vals[2], vals[3], vals[4], vals[5], vals[6]
            dia_hora = vals[7]
            nn = norm(nombre)
            p = None
            if dni:
                p = por_dni.get(dni)
                if p and not misma_persona(p['nombre'], nombre):
                    dni_dudosos.add(dni)
                    p, dni = None, ''
            if p is None:
                p = por_nombre.get(nn)
            if p is None:
                p = dict(nombre=titulo(nombre), dni=dni, email=mail, telefono=contacto,
                         emergencia=emergencia, obra_social=obra, inscripciones=[])
                personas.append(p)
            else:
                for k, v in (('dni', dni), ('email', mail), ('telefono', contacto),
                             ('emergencia', emergencia), ('obra_social', obra)):
                    if not p[k] and v:
                        p[k] = v
            por_nombre.setdefault(nn, p)
            if dni:
                por_dni.setdefault(dni, p)
            firma = (norm(taller), norm(dia_hora))
            if firma in {(norm(i['taller_texto']), norm(i['dia_hora'])) for i in p['inscripciones']}:
                repetidas += 1
                continue
            p['inscripciones'].append(dict(taller_texto=titulo(taller), area=area, turno=turno, dia_hora=dia_hora))
    return personas, repetidas, sorted(dni_dudosos)


def sincronizar(db: Session, contenido: bytes, aplicar: bool) -> dict:
    personas, repetidas, dni_dudosos = leer_planilla(contenido)
    talleres = db.scalars(select(Taller).where(Taller.periodo == PERIODO_ACTUAL)).all()
    alumnos = db.scalars(select(Alumno).options(selectinload(Alumno.inscripciones))).all()
    db_por_dni = {a.dni: a for a in alumnos if a.dni}
    db_por_nombre: dict[str, list[Alumno]] = defaultdict(list)
    for a in alumnos:
        db_por_nombre[norm(a.nombre)].append(a)

    res = dict(personas_planilla=len(personas), inscripciones_planilla=sum(len(p['inscripciones']) for p in personas),
               repetidas_descartadas=repetidas, dni_compartidos=dni_dudosos,
               alumnos_nuevos=0, alumnos_actualizados=0, inscripciones_nuevas=0, inscripciones_bajas=0,
               inscripciones_reubicadas=0,
               alumnos_sin_inscripcion=0, sin_taller=0, nuevos=[], bajas=[], aplicado=aplicar)

    vistos: set[int] = set()
    for p in personas:
        a = db_por_dni.get(p['dni']) if p['dni'] else None
        if a is not None and not misma_persona(a.nombre, p['nombre']):
            a = None
        if a is None:
            candidatos = [c for c in db_por_nombre.get(norm(p['nombre']), []) if id(c) not in vistos] \
                or db_por_nombre.get(norm(p['nombre']), [])
            a = candidatos[0] if candidatos else None
        if a is None:
            a = Alumno(nombre=p['nombre'], dni=p['dni'], email=p['email'], telefono=p['telefono'],
                       emergencia=p['emergencia'], obra_social=p['obra_social'])
            a.inscripciones = []
            if aplicar:
                db.add(a)
            res['alumnos_nuevos'] += 1
            res['nuevos'].append(p['nombre'])
        else:
            cambio = False
            for k in ('dni', 'email', 'telefono', 'emergencia', 'obra_social'):
                v = p[k]
                if v and v != getattr(a, k):
                    if aplicar:
                        setattr(a, k, v)
                    cambio = True
            if cambio:
                res['alumnos_actualizados'] += 1
        vistos.add(id(a))
        if a.dni:
            db_por_dni.setdefault(a.dni, a)

        actuales = {i.taller_id or ('T', norm(i.taller_texto)): i for i in a.inscripciones
                    if i.periodo == PERIODO_ACTUAL}
        quedan = set()
        for ins in p['inscripciones']:
            t = buscar_taller(talleres, ins['taller_texto'], ins['dia_hora'])
            clave = t.id if t else ('T', norm(ins['taller_texto']))
            if t is None:
                res['sin_taller'] += 1
            if clave in actuales:
                quedan.add(clave)
                continue
            # mismo taller con otro horario/aula: se conserva la inscripción (y su estado de pago)
            parecida = next((k for k, i in actuales.items() if k not in quedan
                             and similitud(i.taller.nombre if i.taller else i.taller_texto, ins['taller_texto']) >= 0.9), None)
            if parecida is not None:
                quedan.add(parecida)
                if t is not None and actuales[parecida].taller_id != t.id:
                    res['inscripciones_reubicadas'] += 1
                    if aplicar:
                        actuales[parecida].taller = t
                continue
            quedan.add(clave)
            res['inscripciones_nuevas'] += 1
            if aplicar:
                db.add(Inscripcion(alumno=a, taller=t, taller_texto=ins['taller_texto'],
                                   area=ins['area'], turno=ins['turno']))
        for clave, i in actuales.items():
            if clave not in quedan:
                res['inscripciones_bajas'] += 1
                res['bajas'].append(f"{a.nombre} — {i.taller.nombre if i.taller else i.taller_texto}")
                if aplicar:
                    db.delete(i)

    for a in alumnos:
        if id(a) in vistos:
            continue
        vigentes = [i for i in a.inscripciones if i.periodo == PERIODO_ACTUAL]
        if vigentes:
            res['alumnos_sin_inscripcion'] += 1
        for i in vigentes:
            res['inscripciones_bajas'] += 1
            res['bajas'].append(f"{a.nombre} — {i.taller.nombre if i.taller else i.taller_texto}")
            if aplicar:
                db.delete(i)

    if aplicar:
        db.commit()
    else:
        db.rollback()
    return res
