"""Claves de acceso y control de intentos fallidos."""
import hashlib
import hmac
import os
import secrets
import time

ITERACIONES = 200_000
INTENTOS_MAX = 5
BLOQUEO_SEGUNDOS = 15 * 60
VENTANA_SEGUNDOS = 15 * 60
HORAS_SESION = 12

_intentos: dict[str, list[float]] = {}


def hash_clave(clave: str) -> str:
    sal = secrets.token_hex(16)
    huella = hashlib.pbkdf2_hmac("sha256", clave.encode(), bytes.fromhex(sal), ITERACIONES).hex()
    return f"pbkdf2${ITERACIONES}${sal}${huella}"


def verificar_clave(clave: str, guardada: str) -> bool:
    partes = guardada.split("$")
    if len(partes) != 4 or partes[0] != "pbkdf2":
        return False
    iteraciones, sal, huella = int(partes[1]), partes[2], partes[3]
    calculada = hashlib.pbkdf2_hmac("sha256", clave.encode(), bytes.fromhex(sal), iteraciones).hex()
    return hmac.compare_digest(calculada, huella)


def clave_inicial() -> str:
    """Clave del primer usuario: la de la variable de entorno o una al azar."""
    return os.environ.get("ATL_CLAVE_INICIAL") or secrets.token_urlsafe(12)


def clave_de_firma(carpeta: str) -> str:
    """Clave con la que se firman las sesiones: la del entorno o una guardada en disco."""
    del_entorno = os.environ.get("ATL_SECRET")
    if del_entorno:
        return del_entorno
    archivo = os.path.join(carpeta, "atl_firma")
    if os.path.exists(archivo):
        with open(archivo, encoding="utf-8") as f:
            return f.read().strip()
    valor = secrets.token_hex(32)
    with open(os.open(archivo, os.O_CREAT | os.O_WRONLY, 0o600), "w", encoding="utf-8") as f:
        f.write(valor)
    return valor


def _limpiar(llave: str, ahora: float) -> list[float]:
    recientes = [t for t in _intentos.get(llave, []) if ahora - t < VENTANA_SEGUNDOS]
    _intentos[llave] = recientes
    return recientes


def bloqueo_restante(llave: str) -> int:
    """Segundos que faltan para poder reintentar, o 0 si no está bloqueado."""
    ahora = time.time()
    recientes = _limpiar(llave, ahora)
    if len(recientes) < INTENTOS_MAX:
        return 0
    return max(0, int(BLOQUEO_SEGUNDOS - (ahora - recientes[-1])))


def registrar_fallo(llave: str) -> None:
    ahora = time.time()
    _limpiar(llave, ahora)
    _intentos[llave].append(ahora)


def limpiar_intentos(llave: str) -> None:
    _intentos.pop(llave, None)
