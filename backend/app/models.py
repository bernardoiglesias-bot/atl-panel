from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
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


class Tarea(Base):
    """Pendiente de gestión, clasificado por plazo."""

    __tablename__ = "tarea"
    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(200))
    detalle: Mapped[str] = mapped_column(Text, default="")
    plazo: Mapped[str] = mapped_column(String(20), default="Corto")  # Urgente, Corto, Mediano, Largo
    estado: Mapped[str] = mapped_column(String(20), default="Pendiente")
    responsable: Mapped[str] = mapped_column(String(120), default="")
    area: Mapped[str] = mapped_column(String(60), default="")
    espacio_id: Mapped[int | None] = mapped_column(ForeignKey("espacio.id"), nullable=True)
    vence: Mapped[date | None] = mapped_column(Date, nullable=True)
    creada: Mapped[date] = mapped_column(Date, default=date.today)
    cerrada: Mapped[date | None] = mapped_column(Date, nullable=True)
    objetivo_id: Mapped[int | None] = mapped_column(ForeignKey("objetivo.id"), nullable=True)

    espacio: Mapped[Espacio | None] = relationship()
    objetivo: Mapped[Objetivo | None] = relationship(back_populates="tareas")

    @property
    def vencida(self) -> bool:
        return bool(self.vence and self.estado != "Hecha" and self.vence < date.today())


class Gasto(Base):
    """Circuito presupuesto → pedido de adelanto → rendición."""

    __tablename__ = "gasto"
    id: Mapped[int] = mapped_column(primary_key=True)
    concepto: Mapped[str] = mapped_column(String(200))
    detalle: Mapped[str] = mapped_column(Text, default="")
    rubro: Mapped[str] = mapped_column(String(60), default="")
    etapa: Mapped[str] = mapped_column(String(20), default="Necesidad")
    # Necesidad → Presupuestado → Adelanto pedido → Adelanto recibido → Rendido → Rechazado
    monto_presupuestado: Mapped[float | None] = mapped_column(Float, nullable=True)
    monto_adelanto: Mapped[float | None] = mapped_column(Float, nullable=True)
    monto_rendido: Mapped[float | None] = mapped_column(Float, nullable=True)
    proveedor: Mapped[str] = mapped_column(String(120), default="")
    solicitante: Mapped[str] = mapped_column(String(120), default="")
    espacio_id: Mapped[int | None] = mapped_column(ForeignKey("espacio.id"), nullable=True)
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    fecha_necesidad: Mapped[date | None] = mapped_column(Date, nullable=True)
    notas: Mapped[str] = mapped_column(Text, default="")

    espacio: Mapped[Espacio | None] = relationship()

    @property
    def pendiente_rendir(self) -> float:
        return round((self.monto_adelanto or 0) - (self.monto_rendido or 0), 2)


class Feedback(Base):
    """Devolución o reunión de seguimiento con un docente o alguien del personal."""

    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    docente_id: Mapped[int | None] = mapped_column(ForeignKey("docente.id"), nullable=True)
    personal_id: Mapped[int | None] = mapped_column(ForeignKey("personal.id"), nullable=True)
    persona_texto: Mapped[str] = mapped_column(String(120), default="")
    tipo: Mapped[str] = mapped_column(String(30), default="Seguimiento")
    # Seguimiento, Felicitación, Reclamo, Pedido, Entrevista
    valoracion: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 a 5
    tema: Mapped[str] = mapped_column(String(200), default="")
    comentario: Mapped[str] = mapped_column(Text, default="")
    acuerdos: Mapped[str] = mapped_column(Text, default="")
    registrado_por: Mapped[str] = mapped_column(String(120), default="")

    docente: Mapped[Docente | None] = relationship()
    personal: Mapped[Personal | None] = relationship()


class Objetivo(Base):
    """Objetivo de gestión con su indicador y seguimiento."""

    __tablename__ = "objetivo"
    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(200))
    detalle: Mapped[str] = mapped_column(Text, default="")
    periodo: Mapped[str] = mapped_column(String(10), default=PERIODO_ACTUAL)
    responsable: Mapped[str] = mapped_column(String(120), default="")
    indicador: Mapped[str] = mapped_column(String(120), default="manual")
    unidad: Mapped[str] = mapped_column(String(20), default="")
    valor_inicial: Mapped[float | None] = mapped_column(Float, nullable=True)
    valor_meta: Mapped[float | None] = mapped_column(Float, nullable=True)
    valor_actual: Mapped[float | None] = mapped_column(Float, nullable=True)
    vence: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="En curso")

    tareas: Mapped[list[Tarea]] = relationship(back_populates="objetivo")
    seguimientos: Mapped[list[Seguimiento]] = relationship(back_populates="objetivo",
                                                           cascade="all, delete-orphan")


class Seguimiento(Base):
    """Registro de avance de un objetivo."""

    __tablename__ = "seguimiento"
    id: Mapped[int] = mapped_column(primary_key=True)
    objetivo_id: Mapped[int] = mapped_column(ForeignKey("objetivo.id"))
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    valor: Mapped[float | None] = mapped_column(Float, nullable=True)
    comentario: Mapped[str] = mapped_column(Text, default="")

    objetivo: Mapped[Objetivo] = relationship(back_populates="seguimientos")


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
