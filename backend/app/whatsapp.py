"""Normalización de celulares argentinos para WhatsApp (formato 549 + característica + número)."""
import re

CARACTERISTICA_LOCAL = "261"


def normalizar_celular(texto: str) -> tuple[str | None, str]:
    """Devuelve (número para wa.me, motivo si no se pudo usar)."""
    if not (texto or "").strip():
        return None, "Sin teléfono"
    primero = re.split(r"/|,|;|\s+-\s+|\s+y\s+|\s+o\s+", texto.strip())[0]
    d = re.sub(r"\D", "", primero)
    if d.startswith("00"):
        d = d[2:]
    if d.startswith("54") and len(d) >= 12:
        d = d[2:]
        if d.startswith("9"):
            d = d[1:]
    if d.startswith("0"):
        d = d[1:]
    if len(d) == 12:
        for largo in (2, 3, 4):
            if d[largo:largo + 2] == "15":
                d = d[:largo] + d[largo + 2:]
                break
    if len(d) == 9 and d.startswith("15"):
        d = CARACTERISTICA_LOCAL + d[2:]
    if len(d) == 7:
        return None, "Falta la característica (¿fijo?)"
    if len(d) != 10:
        return None, "Le faltan o le sobran números"
    return "549" + d, ""
