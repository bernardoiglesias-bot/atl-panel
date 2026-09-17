# Backend — Panel de gestión ATL

API FastAPI del panel de Aulas para el Tiempo Libre.

```bash
poetry install
poetry run uvicorn app.main:app --reload
```

Variables opcionales:

- `ATL_CLAVE_INICIAL`: contraseña del primer acceso (`coordinacion`), que se crea sólo la primera vez.
  Si no se define, se genera una al azar y hay que cambiarla desde la pantalla de accesos.
- `ATL_SECRET`: clave con la que se firman las sesiones. Si no se define, se guarda una junto a la base.
- `ATL_DB_PATH`: ubicación del archivo SQLite (por defecto `/data/atl.db` si existe `/data`).
- `ATL_BACKUP_DIR`: carpeta de las copias de seguridad (por defecto `respaldos/` junto a la base).

Seguridad de acceso: un usuario por persona con contraseña propia (PBKDF2), sesión de 12 horas y
bloqueo de 15 minutos después de 5 intentos fallidos. Copia de la base cada 6 horas, se guardan las
últimas 14.
