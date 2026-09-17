"""Copia de seguridad diaria de la base."""
import glob
import os
import sqlite3
import threading
import time
from datetime import date

from .db import DB_PATH

CARPETA = os.environ.get("ATL_BACKUP_DIR", os.path.join(os.path.dirname(os.path.abspath(DB_PATH)), "respaldos"))
COPIAS_A_GUARDAR = 14
INTERVALO_SEGUNDOS = 6 * 60 * 60


def copiar() -> str:
    """Guarda una copia del día y borra las más viejas. Devuelve la ruta."""
    os.makedirs(CARPETA, exist_ok=True)
    destino = os.path.join(CARPETA, f"atl-{date.today().isoformat()}.db")
    origen = sqlite3.connect(DB_PATH)
    try:
        copia = sqlite3.connect(destino)
        try:
            origen.backup(copia)
        finally:
            copia.close()
    finally:
        origen.close()
    viejas = sorted(glob.glob(os.path.join(CARPETA, "atl-*.db")))[:-COPIAS_A_GUARDAR]
    for v in viejas:
        os.remove(v)
    return destino


def _bucle() -> None:
    while True:
        try:
            copiar()
        except (OSError, sqlite3.Error):
            pass
        time.sleep(INTERVALO_SEGUNDOS)


def arrancar() -> None:
    """Deja corriendo la copia periódica en segundo plano."""
    threading.Thread(target=_bucle, daemon=True, name="respaldo-atl").start()
