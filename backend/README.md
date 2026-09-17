# Backend — Panel de gestión ATL

API FastAPI del panel de Aulas para el Tiempo Libre.

```bash
poetry install
poetry run uvicorn app.main:app --reload
```

Variables opcionales:

- `ATL_PASSWORD_HASH`: sha256 de la contraseña de acceso.
- `ATL_SECRET`: clave con la que se firman los tokens de sesión.
- `ATL_DB_PATH`: ubicación del archivo SQLite (por defecto `/data/atl.db` si existe `/data`).
