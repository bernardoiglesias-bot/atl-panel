from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

PERIODO_ACTUAL = "1C2026"


class Base(DeclarativeBase):
    pass


class Espacio(Base):
    __tablename__ = "espacio"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    ubicacion: Mapped[str] = mapped_column(String(200), default="")
    capacidad: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uso: Mapped[str] = mapped_column(String(80), default="Taller")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    orden: Mapped[int] = mapped_column(Integer, default=0)


class Docente(Base):
    __tablename__ = "docente"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    dni: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    celular: Mapped[str] = mapped_column(String(40), default="")
    nacimiento: Mapped[str] = mapped_column(String(20), default="")
    facturacion: Mapped[str] = mapped_column(String(120), default="")
    necesidades: Mapped[str] = mapped_column(Text, default="")
    maquinaria: Mapped[str] = mapped_column(Text, default="")
    sugerencias: Mapped[str] = mapped_column(Text, default="")
    cupo_min: Mapped[str] = mapped_column(String(20), default="")
    cupo_max: Mapped[str] = mapped_column(String(20), default="")

    talleres: Mapped[list[Taller]] = relationship(back_populates="docente")


class Personal(Base):
    __tablename__ = "personal"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    funcion: Mapped[str] = mapped_column(String(80), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    telefono: Mapped[str] = mapped_column(String(40), default="")


class Taller(Base):
    """Un taller = un dictado semanal. Los talleres de dos días son dos talleres."""

    __tablename__ = "taller"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200))
    periodo: Mapped[str] = mapped_column(String(10), default=PERIODO_ACTUAL)
    area: Mapped[str] = mapped_column(String(60), default="")
    dia: Mapped[int] = mapped_column(Integer)  # 0 = lunes
    desde: Mapped[str] = mapped_column(String(5))
    hasta: Mapped[str] = mapped_column(String(5))
    turno: Mapped[str] = mapped_column(String(10), default="")
    espacio_id: Mapped[int | None] = mapped_column(ForeignKey("espacio.id"), nullable=True)
    docente_id: Mapped[int | None] = mapped_column(ForeignKey("docente.id"), nullable=True)
    docente_texto: Mapped[str] = mapped_column(String(120), default="")
    estado: Mapped[str] = mapped_column(String(20), default="Con cupo")
    cupo_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observacion: Mapped[str] = mapped_column(Text, default="")
    difusion: Mapped[str] = mapped_column(Text, default="")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    espacio: Mapped[Espacio | None] = relationship()
    docente: Mapped[Docente | None] = relationship(back_populates="talleres")
    inscripciones: Mapped[list[Inscripcion]] = relationship(back_populates="taller")


class Alumno(Base):
    __tablename__ = "alumno"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    dni: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    telefono: Mapped[str] = mapped_column(String(60), default="")
    emergencia: Mapped[str] = mapped_column(String(150), default="")
    obra_social: Mapped[str] = mapped_column(String(120), default="")
    notas: Mapped[str] = mapped_column(Text, default="")

    inscripciones: Mapped[list[Inscripcion]] = relationship(back_populates="alumno")

    @property
    def ficha_completa(self) -> bool:
        return bool(self.dni and (self.email or self.telefono))


class Inscripcion(Base):
    __tablename__ = "inscripcion"
    id: Mapped[int] = mapped_column(primary_key=True)
    alumno_id: Mapped[int] = mapped_column(ForeignKey("alumno.id"))
    taller_id: Mapped[int | None] = mapped_column(ForeignKey("taller.id"), nullable=True)
    taller_texto: Mapped[str] = mapped_column(String(200), default="")
    periodo: Mapped[str] = mapped_column(String(10), default=PERIODO_ACTUAL)
    area: Mapped[str] = mapped_column(String(60), default="")
    turno: Mapped[str] = mapped_column(String(10), default="")
    estado_pago: Mapped[str] = mapped_column(String(20), default="Sin dato")

    alumno: Mapped[Alumno] = relationship(back_populates="inscripciones")
    taller: Mapped[Taller | None] = relationship(back_populates="inscripciones")


class Evento(Base):
    """Reunión, mantenimiento, actividad de gestión, feriado o suspensión."""

    __tablename__ = "evento"
    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(200))
    tipo: Mapped[str] = mapped_column(String(30), default="Reunión")
    fecha: Mapped[date] = mapped_column(Date)
    desde: Mapped[str] = mapped_column(String(5), default="09:00")
    hasta: Mapped[str] = mapped_column(String(5), default="10:00")
    espacio_id: Mapped[int | None] = mapped_column(ForeignKey("espacio.id"), nullable=True)
    responsable: Mapped[str] = mapped_column(String(120), default="")
    notas: Mapped[str] = mapped_column(Text, default="")

    espacio: Mapped[Espacio | None] = relationship()


class ExcepcionClase(Base):
    """Cambio puntual de una clase en una fecha: se suspende o cambia de aula."""

    __tablename__ = "excepcion_clase"
    __table_args__ = (UniqueConstraint("taller_id", "fecha"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    taller_id: Mapped[int] = mapped_column(ForeignKey("taller.id"))
    fecha: Mapped[date] = mapped_column(Date)
    suspendida: Mapped[bool] = mapped_column(Boolean, default=False)
    espacio_id: Mapped[int | None] = mapped_column(ForeignKey("espacio.id"), nullable=True)
    motivo: Mapped[str] = mapped_column(String(200), default="")

    taller: Mapped[Taller] = relationship()
    espacio: Mapped[Espacio | None] = relationship()
