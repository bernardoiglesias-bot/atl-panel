# Panel de gestión — Aulas para el Tiempo Libre

Sistema compartido por los dos coordinadores: agenda diaria de todos los espacios y bases de
talleres, docentes, alumnos e inscripciones del 1º cuatrimestre 2026.

## Cómo correrlo

Backend (FastAPI + SQLite):

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --port 8000
```

La primera vez carga `backend/data/seed.json` (los datos reales del centro) en `backend/atl.db`.

Frontend (React + Vite):

```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno

| Variable        | Para qué sirve                          | Valor por defecto        |
| --------------- | --------------------------------------- | ------------------------ |
| `ATL_PASSWORD`  | contraseña de acceso de coordinación    | `atl2026`                |
| `ATL_SECRET`    | clave de firma de los tokens de sesión  | clave local              |
| `ATL_DB_PATH`   | archivo SQLite                          | `/data/atl.db` o `backend/atl.db` |
| `VITE_API_URL`  | URL del backend para el frontend        | mismo origen             |

## Cómo se arma `seed.json`

`scripts/extract_seed.py` lee los archivos originales del centro (Word semanal de talleres,
Excel de alumnos, de profesores y de personal) y genera `backend/data/seed.json`. El Word
semanal es la fuente de verdad de la grilla; el cronograma en PDF quedó descartado.
