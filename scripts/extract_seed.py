"""Extrae los datos reales de los archivos del centro y arma backend/data/seed.json.

Fuente de verdad de la grilla: TALLERES 2026 semanales.docx, con las decisiones
de la coordinación aplicadas (3 bajas, Ajedrez al viernes, Legados no dictado).
"""
import json
import os
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher

from docx import Document
from openpyxl import load_workbook

A = '/home/ubuntu/attachments'
WORD = f'{A}/055da4e0-34fe-44e2-b25a-4efa85aae4ce/TALLERES_2026_semanales.docx'
ALUMNOS = f'{A}/03f9e3e2-c2bd-42cb-8b36-0829c19cb9fc/Alumnos_por_Turno-Taller-Día_y_Horario_1.xlsx'
DOCENTES = f'{A}/376136e6-d067-4b23-b0fb-4dfd85731e5d/Datos_Profesores_as_Aulas_para_el_Tiempo_Libre_2026_.xlsx'
PERSONAL = f'{A}/e77dce36-d82d-4a6b-bdb5-1daac46e5dc1/Planilla_de_Personal_-_Aulas_para_el_Tiempo_Libre.xlsx'
OUT = os.path.join(os.path.dirname(__file__), '..', 'backend', 'data', 'seed.json')

DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
DIA_IDX = {'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5}


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.sub(r'[^A-Z0-9 ]', ' ', s).split())


def titulo(s):
    """Normaliza el nombre de taller/persona a Mayúscula Inicial, respetando siglas cortas."""
    s = ' '.join(str(s or '').split())
    if not s:
        return ''
    if s.isupper() or s.islower():
        chicas = {'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'con', 'a', 'al', 'por'}
        out = []
        for i, w in enumerate(s.lower().split()):
            out.append(w if i and w in chicas else w.capitalize())
        s = ' '.join(out)
    return s


def nh(h):
    h = str(h).upper().replace(' ', '').replace(';', ':').replace('.', ':').replace(',', ':').replace('HS', '')
    m = re.match(r'(\d{1,2})(?::(\d{2}))?A(\d{1,2})(?::(\d{2}))?', h)
    return f"{int(m.group(1)):02d}:{m.group(2) or '00'}-{int(m.group(3)):02d}:{m.group(4) or '00'}" if m else h


def blk(s):
    s = norm(s)
    d = next((x for x in DIA_IDX if x in s), None)
    t = 'Mañana' if 'MANANA' in s or 'MAANA' in s else 'Tarde'
    return d, t


# ---------------------------------------------------------------- espacios
ESPACIOS = [
    ('Aula 1', 'Planta baja, en la entrada', 20, 'Taller'),
    ('Aula 2', 'Frente al buffet', 16, 'Taller'),
    ('Aula 3', 'Al lado del baño, planta baja', 16, 'Taller'),
    ('Aula 4', 'Planta baja, pasillo izquierdo de mesas altas', 25, 'Taller'),
    ('Aula 5', 'Garage frente al buffet', 10, 'Taller'),
    ('Aula 6', 'Patio, donde está el horno cerámico', 16, 'Taller'),
    ('Aula 7', 'Quincho grande', 20, 'Taller'),
    ('Aula 8', 'Cochera grande', 22, 'Taller'),
    ('Aula 9', '1º piso, sala de coworking con mesa redonda', 5, 'Reuniones'),
    ('Aula 10', '1º piso, aula grande', 16, 'Taller'),
    ('Aula 11', '1º piso, donde está la biblioteca', 10, 'Taller'),
    ('Patio', 'Patio central', None, 'Actividades y eventos'),
    ('Buffet', 'Buffet', None, 'Actividades y eventos'),
    ('Oficina de Administración', 'Planta baja', None, 'Gestión'),
    ('Oficina de Coordinación', 'Planta baja', None, 'Gestión'),
]

# --------------------------------------------------------- grilla (Word)
BAJAS = [
    ('LUNES', 'ELENCO DE TEATRO', '19:00-20:50'),
    ('MIERCOLES', 'DECORACION Y DISENO DE INTERIORES NIVEL 2', '15:00-17:50'),
    ('JUEVES', 'CAMBIAR INFORMATICA Y TELEFONIA', '09:00-10:50'),
]


def estado(obs):
    o = norm(obs)
    if 'NO SE DA' in o:
        return 'No se da'
    if 'CERRADO' in o:
        return 'Cerrado'
    if 'LLENO' in o:
        return 'Lleno'
    if 'CUPO' in o or 'LIBRE' in o:
        return 'Con cupo'
    if 'NUEVO' in o:
        return 'Nuevo'
    return 'Sin dato'


doc = Document(WORD)
clases = []
for t in doc.tables:
    d, turno = blk(t.rows[0].cells[0].text)
    if d is None:
        continue
    for r in t.rows[2:]:
        c = [x.text.strip() for x in r.cells]
        if not c[0] or norm(c[0]).startswith('LIBRE') or 'CHILL' in norm(c[0]):
            continue
        clases.append(dict(dia=d, turno=turno, taller=c[0], docente=c[1], horario=nh(c[2]), aula=c[3], obs=c[4]))

clases = [c for c in clases if not any(c['dia'] == d and norm(c['taller']) == t and c['horario'] == h for d, t, h in BAJAS)]

for c in clases:
    if c['dia'] == 'JUEVES' and norm(c['taller']) == 'AJEDREZ':
        c.update(dia='VIERNES', turno='Tarde', horario='15:00-16:50', aula='4')
    if norm(c['taller']) == 'CONVERSACION PREINTERMEDIATE':
        c['taller'] = 'Conversación Preintermedio'
    if c['dia'] == 'VIERNES' and 'LEGADOS' in norm(c['taller']) and c['horario'] == '15:00-16:50':
        c['obs'] = (c['obs'] + ' | NO SE DA: no se formó el grupo').strip(' |')

# ------------------------------------------------------------- docentes
wb = load_workbook(DOCENTES, data_only=True)
ws = wb['Respuestas de formulario 1']
filas = list(ws.iter_rows(min_row=2, values_only=True))


def txt(v):
    if v is None:
        return ''
    s = str(v).strip()
    return s[:-2] if s.endswith('.0') and s[:-2].isdigit() else s


docentes = []
for f in filas:
    nombre = txt(f[0])
    if not nombre:
        continue
    docentes.append(dict(
        nombre=' '.join(nombre.split()),
        dni=txt(f[2]),
        celular=txt(f[3]),
        email=txt(f[4]) or txt(f[1]),
        nacimiento=txt(f[5])[:10],
        cupo_min=txt(f[14]),
        cupo_max=txt(f[15]),
        necesidades=txt(f[17]),
        difusion=txt(f[18]),
        maquinaria=txt(f[19]),
        facturacion=txt(f[20]),
        sugerencias=txt(f[21]),
        talleres_declarados=[txt(f[i]) for i in (6, 8, 10, 12, 23) if txt(f[i])],
    ))

# los nombres de la grilla vienen como "APELLIDO, NOMBRE"; se mapean a la ficha
by_tokens = {}
for d in docentes:
    by_tokens[frozenset(norm(d['nombre']).split())] = d


def match_docente(nombre_grilla):
    t = set(norm(nombre_grilla).replace(',', ' ').split())
    if not t:
        return None
    mejor, score = None, 0
    for toks, d in by_tokens.items():
        s = len(t & toks)
        if s > score:
            mejor, score = d, s
    return mejor if score >= 2 or (score == 1 and len(t) == 1) else None


# ------------------------------------------------------------- personal
wb = load_workbook(PERSONAL, data_only=True)
ws = wb['Hoja 1']
personal = []
for r in ws.iter_rows(min_row=7, values_only=True):
    if not r[1]:
        continue
    personal.append(dict(nombre=txt(r[1]), funcion=txt(r[2]), email=txt(r[3]), telefono=txt(r[4])))

# ------------------------------------------------------- talleres + clases
talleres = []
for c in clases:
    desde, hasta = c['horario'].split('-')
    doc_ficha = match_docente(c['docente'])
    cupo = None
    if doc_ficha:
        m = re.search(r'\d+', doc_ficha['cupo_max'] or '')
        if m:
            cupo = int(m.group())
    talleres.append(dict(
        nombre=titulo(c['taller']),
        docente=titulo(c['docente'].replace(',', ', ').replace('  ', ' ')) if c['docente'] else '',
        docente_ficha=doc_ficha['nombre'] if doc_ficha else None,
        dia=DIA_IDX[c['dia']],
        desde=desde,
        hasta=hasta,
        turno=c['turno'],
        espacio=f"Aula {c['aula']}" if c['aula'].strip().isdigit() else (c['aula'].strip() or None),
        estado=estado(c['obs']),
        observacion=c['obs'].strip(),
        cupo_max=cupo,
        difusion=doc_ficha['difusion'] if doc_ficha else '',
    ))

talleres.sort(key=lambda t: (t['dia'], t['desde'], t['nombre']))

# ------------------------------------------------------------- alumnos
wb = load_workbook(ALUMNOS, data_only=True)
inscripciones = []
HORA = re.compile(r'(\d{1,2})[:.]?(\d{2})?\s*(?:HS|H)?')

idx_taller = defaultdict(list)
for i, t in enumerate(talleres):
    idx_taller[norm(t['nombre'])].append(i)


VACIAS = {'TALLER', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'EN', 'PARA', 'CON', 'POR', 'A',
          'NIVEL', 'NUEVO', 'CUATRIMESTRAL', 'CONFIRMADO', 'UNICO'}


def toks(s):
    t = {w for w in norm(s).split() if w not in VACIAS}
    return t or set(norm(s).split())


def similitud(a, b):
    ta, tb = toks(a), toks(b)
    contencion = len(ta & tb) / max(min(len(ta), len(tb)), 1)
    return max(SequenceMatcher(None, norm(a), norm(b)).ratio(), contencion)


def buscar_taller(nombre, dia_hora):
    dh = norm(dia_hora)
    dia = next((DIA_IDX[d] for d in DIA_IDX if d in dh), None)
    m = HORA.search(dh.split(' ', 1)[-1] if dia is not None else dh)
    hora = int(m.group(1)) if m else None

    mejor, mejor_score, mejor_sim = None, 0.0, 0.0
    for i, t in enumerate(talleres):
        sim = similitud(nombre, t['nombre'])
        if sim < 0.45:
            continue
        score = 0.6 * sim
        if dia is not None and t['dia'] == dia:
            score += 0.25
        if hora is not None and int(t['desde'][:2]) == hora:
            score += 0.15
        if score > mejor_score:
            mejor, mejor_score, mejor_sim = i, score, sim
    # exige nombre parecido, y además día o franja coincidente salvo nombre casi idéntico
    if mejor is None:
        return None
    if mejor_score >= 0.75 or mejor_sim >= 0.9:
        return mejor
    return None


def misma_persona(a, b):
    ta, tb = set(norm(a).split()), set(norm(b).split())
    if ta <= tb or tb <= ta:
        return True
    return SequenceMatcher(None, norm(a), norm(b)).ratio() >= 0.75


vistas = set()
repetidas = 0
dni_dudosos = set()
alumnos_list = []
por_dni = {}
por_nombre = {}

for ws in wb.worksheets:
    area, _, turno = ws.title.rpartition(' ')
    header = None
    for r in ws.iter_rows(values_only=True):
        vals = [txt(v) for v in r]
        if not any(vals):
            continue
        if header is None:
            if norm(vals[0]) == 'TALLER' or norm(vals[1]).startswith('NOMBRE'):
                header = True
            continue
        taller, nombre = vals[0].strip(), ' '.join(vals[1].replace(',', ' ').split())
        if not nombre or not taller:
            continue
        dni, mail, contacto, emergencia, obra = vals[2], vals[3], vals[4], vals[5], vals[6]
        dia_hora, prof = vals[7], vals[8]
        nn = norm(nombre)
        al = None
        if dni:
            al = por_dni.get(dni)
            if al and not misma_persona(al['nombre'], nombre):
                # el mismo DNI en dos personas con nombres distintos: error de carga, se separan
                dni_dudosos.add(dni)
                al, dni = None, ''
        if al is None:
            al = por_nombre.get(nn)
        if al is None:
            al = dict(nombre=titulo(nombre), dni=dni, email=mail, telefono=contacto,
                      emergencia=emergencia, obra_social=obra)
            alumnos_list.append(al)
        else:
            for k, v in (('dni', dni), ('email', mail), ('telefono', contacto),
                         ('emergencia', emergencia), ('obra_social', obra)):
                if not al[k] and v:
                    al[k] = v
        por_nombre.setdefault(nn, al)
        if dni:
            por_dni.setdefault(dni, al)
        clave = id(al)
        firma = (clave, norm(taller), norm(dia_hora))
        if firma in vistas:
            repetidas += 1
            continue
        vistas.add(firma)
        inscripciones.append(dict(alumno=clave, taller_texto=titulo(taller), area=area, turno=turno,
                                  dia_hora=dia_hora, docente_texto=prof,
                                  taller_idx=buscar_taller(taller, dia_hora)))

indice = {id(a): i for i, a in enumerate(alumnos_list)}
for ins in inscripciones:
    ins['alumno_idx'] = indice[ins.pop('alumno')]

seed = dict(
    espacios=[dict(nombre=n, ubicacion=u, capacidad=c, uso=us) for n, u, c, us in ESPACIOS],
    docentes=docentes,
    personal=personal,
    talleres=talleres,
    alumnos=alumnos_list,
    inscripciones=inscripciones,
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=1)

sin_taller = sum(1 for i in inscripciones if i['taller_idx'] is None)
print('espacios', len(seed['espacios']), '| talleres', len(talleres), '| docentes fichas', len(docentes),
      '| personal', len(personal), '| alumnos', len(alumnos_list), '| inscripciones', len(inscripciones),
      '| sin taller', sin_taller)
print('inscripciones repetidas descartadas:', repetidas, '| DNI compartidos por personas distintas:', len(dni_dudosos))
print('talleres sin docente de ficha:', sum(1 for t in talleres if not t['docente_ficha']))
faltan = sorted({(i['taller_texto'], i['dia_hora']) for i in inscripciones if i['taller_idx'] is None})
for x in faltan[:40]:
    print('  sin match:', x)
