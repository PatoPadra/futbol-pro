from typing import Dict, List, Literal, Optional, get_args

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from constants import (
    ATTENDANCE_IDS,
    CLASSIC_TRACKED_STATS,
    DEFAULT_GROUP_MEMBER_ROLE,
    DEFAULT_MATCH_MODE,
    DEFAULT_MATCH_TYPE,
    GENDER_IDS,
    GROUP_MEMBER_ROLE_IDS,
    MATCH_MODE_IDS,
    MATCH_TYPE_IDS,
    MEMBERSHIP_STATUSES,
    REGISTRATION_STATUSES,
    TEAM_GENERATION_STATUSES,
    TOURNAMENT_FORMAT_IDS,
    TRACKABLE_STAT_MAP,
    USER_ROLE_IDS,
)

# Tope de una estadística en un partido. Como el del marcador, es la red contra
# el dedo gordo: nadie mete 400 goles, y un número así ensucia el promedio del
# jugador para siempre.
MAX_STAT_VALUE = 99


def _limpiar_valores_de_stats(valores: Optional[Dict[str, int]]) -> Optional[Dict[str, int]]:
    """Valida el dict de estadísticas: claves conocidas, enteros de 0 a 99.

    Una clave que no está en el catálogo es un error del cliente y no se ignora
    en silencio: si el front manda "goles" en vez de "goals", queremos enterarnos
    ahora y no dentro de tres meses cuando alguien note que faltan datos.
    """
    if valores is None:
        return None

    limpios: Dict[str, int] = {}
    for stat_id, valor in valores.items():
        if stat_id not in TRACKABLE_STAT_MAP:
            raise ValueError(f"Estadística desconocida: {stat_id}")
        if not isinstance(valor, int) or isinstance(valor, bool):
            raise ValueError(f"{stat_id} tiene que ser un número entero")
        if valor < 0 or valor > MAX_STAT_VALUE:
            raise ValueError(f"{stat_id} tiene que estar entre 0 y {MAX_STAT_VALUE}")
        if valor:
            limpios[stat_id] = valor
    return limpios

# El género es un Literal y no un str suelto para que un valor inventado sea un
# 422 del framework y no un dato basura guardado en Mongo.
Gender = Literal["masculino", "femenino", "otro", "prefiero_no_decir"]

# Modo, tipo y asistencia siguen el mismo criterio que Gender: un Literal, para
# que un valor inventado sea un 422 del framework y no un dato basura en Mongo.
#
# Los valores están escritos dos veces (acá y en el catálogo de constants.py)
# porque un Literal necesita literales; no se puede construir desde una lista en
# runtime. El assert de abajo hace que esa duplicación no pueda derivar: si
# alguien agrega un modo en un solo lado, la app no arranca — que es mucho mejor
# que enterarse tres pantallas después, con datos ya guardados.
MatchMode = Literal["diversion", "basico", "avanzado", "pro", "entrenador"]
MatchType = Literal["oficial", "practica"]
Attendance = Literal["presente", "ausente", "sin_aviso"]

# Los mismos Literal para los ejes que hasta ahora viajaban como `str` pelado.
# `member_role` es el que más falta hacía: la lista estaba escrita a mano en ocho
# lugares y el front terminó leyendo el eje equivocado (el rol global, que usa la
# misma palabra "organizador" para otra cosa).
GroupMemberRole = Literal["organizador", "frecuente", "invitado"]
RegistrationStatus = Literal["titular", "suplente", "baja"]
MembershipStatus = Literal["activo", "inactivo"]
TeamGenerationStatus = Literal["borrador", "confirmado"]
TournamentFormat = Literal["liga", "zonas_eliminatoria", "eliminacion"]
UserRole = Literal["admin", "jugador"]

assert set(get_args(MatchMode)) == set(MATCH_MODE_IDS), "MatchMode y MATCH_MODES no coinciden"
assert set(get_args(MatchType)) == set(MATCH_TYPE_IDS), "MatchType y MATCH_TYPES no coinciden"
assert set(get_args(Attendance)) == set(ATTENDANCE_IDS), "Attendance y ATTENDANCE_STATUSES no coinciden"
assert set(get_args(Gender)) == set(GENDER_IDS), "Gender y GENDERS no coinciden"
assert set(get_args(GroupMemberRole)) == set(GROUP_MEMBER_ROLE_IDS), "GroupMemberRole y GROUP_MEMBER_ROLES no coinciden"
assert set(get_args(RegistrationStatus)) == set(REGISTRATION_STATUSES), "RegistrationStatus y REGISTRATION_STATUSES no coinciden"
assert set(get_args(MembershipStatus)) == set(MEMBERSHIP_STATUSES), "MembershipStatus y MEMBERSHIP_STATUSES no coinciden"
assert set(get_args(TeamGenerationStatus)) == set(TEAM_GENERATION_STATUSES), "TeamGenerationStatus y TEAM_GENERATION_STATUSES no coinciden"
assert set(get_args(TournamentFormat)) == set(TOURNAMENT_FORMAT_IDS), "TournamentFormat y TOURNAMENT_FORMATS no coinciden"
assert set(get_args(UserRole)) == set(USER_ROLE_IDS), "UserRole y USER_ROLES no coinciden"


class EmailNormalizedModel(BaseModel):
    """Baja el email a minúscula en la capa de modelo.

    Así `Juan@Gmail.com` y `juan@gmail.com` son la misma cuenta en toda la app
    (registro, login, invitados, invitaciones a grupo) sin tener que acordarse
    de hacer `.lower()` en cada ruta.

    Corre en modo `after`: primero EmailStr valida el formato, después
    normalizamos. El valor sigue siendo un str, así que no rompe el tipo.
    `check_fields=False` es necesario porque este modelo base no declara el
    campo `email`; lo declaran las subclases.
    """

    @field_validator("email", mode="after", check_fields=False)
    @classmethod
    def _normalizar_email(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            return value.lower()
        return value


# Auth
# Profile
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[Gender] = None
    primary_position: Optional[str] = None
    secondary_positions: List[str] = Field(default_factory=list)
    unwanted_position: Optional[str] = None


class ProfileResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    photo_url: Optional[str] = None
    birth_date: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    player_type: str
    primary_position: Optional[str] = None
    secondary_positions: List[str] = Field(default_factory=list)
    unwanted_position: Optional[str] = None
    matches_played: int = 0
    created_by: Optional[str] = None
    estimated_level: Optional[float] = None
    created_at: str


class PlayerPublicResponse(BaseModel):
    """Un jugador visto por OTRO jugador.

    Es ProfileResponse menos la contabilidad interna. `email` es dato personal
    de otra persona, `photo_public_id` es la llave con la que se borra un asset
    en Cloudinary, y `user_id`/`created_by` son plomería que la pantalla no usa.

    La pantalla de perfil propio no pasa por acá: pide `/api/profile`, que sí
    devuelve todo porque son tus datos.
    """

    id: str
    name: str
    photo_url: Optional[str] = None
    birth_date: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    player_type: str
    primary_position: Optional[str] = None
    secondary_positions: List[str] = Field(default_factory=list)
    unwanted_position: Optional[str] = None
    matches_played: int = 0
    estimated_level: Optional[float] = None
    created_at: Optional[str] = None


class InvitacionDeGrupo(BaseModel):
    """Lo que ve alguien al abrir un link de invitacion, antes de entrar."""

    token: str
    group_id: str
    group_name: str
    invitado_por: Optional[str] = None
    # Si ya es miembro, la pantalla lo lleva al grupo en vez de ofrecerle entrar.
    ya_soy_miembro: bool = False
    miembros: int = 0


# Guest
class CreateGuestRequest(EmailNormalizedModel):
    name: str
    email: Optional[EmailStr] = None
    gender: Optional[Gender] = None
    primary_position: Optional[str] = None
    estimated_level: float = 5.0


class MergeGuestRequest(BaseModel):
    guest_player_id: str


# Match
class CreateMatchRequest(BaseModel):
    group_id: str
    title: str
    modality: int
    date: str
    time: str
    location: str
    maps_link: Optional[str] = None
    is_recurring: bool = False
    # None a propósito, y no DEFAULT_MATCH_MODE: significa "el que use el grupo".
    # Si acá pusiéramos el default global, un grupo configurado en otro modo lo
    # vería pisado en cada partido que se cree sin tocar el selector.
    mode: Optional[MatchMode] = None
    match_type: MatchType = DEFAULT_MATCH_TYPE
    # None = "no vino nada", y se usa el default del modo. Una lista vacía SÍ es
    # una elección: el organizador destildó todo y no quiere estadísticas.
    tracked_stats: Optional[List[str]] = None
    # Contra quién se juega, cuando el rival no está en la app (modo Entrenador).
    # Es sólo un nombre: el rival no tiene jugadores ni puntaje acá.
    opponent_name: Optional[str] = Field(default=None, max_length=80)


class UpdateMatchRequest(BaseModel):
    title: Optional[str] = None
    modality: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    maps_link: Optional[str] = None
    status: Optional[str] = None
    # El modo sólo se puede cambiar mientras el partido está abierto (lo valida
    # la ruta). Después de eso ya hay equipos armados, evaluaciones o
    # estadísticas cargadas bajo las reglas del modo viejo, y cambiarlo dejaría
    # el historial del jugador contando cosas que no pasaron.
    mode: Optional[MatchMode] = None
    match_type: Optional[MatchType] = None
    # Se congela junto con el modo: cambiar qué se sigue cuando ya hay filas
    # cargadas dejaría columnas a medio llenar sin forma de saber si están vacías
    # porque el jugador no hizo nada o porque no se seguían todavía.
    tracked_stats: Optional[List[str]] = None
    # El nombre del rival sí se puede corregir después: es una etiqueta, no
    # cambia ninguna regla del partido.
    opponent_name: Optional[str] = Field(default=None, max_length=80)


class MatchResultModel(BaseModel):
    """El resultado de un partido, tal como se guarda embebido en el partido.

    Va como `home`/`away` y no como `A`/`B` a propósito. En un partido interno
    home es el equipo A y away el B; en modo Entrenador home es mi equipo y away
    el rival. Una sola forma sirve para los dos casos — y es la misma que ya
    tienen los fixtures de torneo, así que el día que un fixture sea un partido
    de verdad no hay dos conceptos de "resultado" que reconciliar.
    """

    home_score: int
    away_score: int
    # Sólo se llenan cuando el partido es una llave de torneo que se definió por
    # penales. El marcador de arriba sigue siendo el de los noventa minutos.
    home_penalties: Optional[int] = None
    away_penalties: Optional[int] = None
    # El resultado bajó del torneo: no se edita desde el partido.
    from_fixture: bool = False
    notes: Optional[str] = None
    loaded_by: Optional[str] = None
    loaded_by_name: Optional[str] = None
    loaded_at: Optional[str] = None


class SetMatchResultRequest(BaseModel):
    # El techo de 99 no es burocracia: es la red contra el dedo gordo. Un 100-0
    # cargado por error no se ve raro en una tabla, pero cuando el resultado
    # empiece a mover el puntaje de los jugadores, un margen así corrompe a los
    # veintidós de una sola vez.
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)
    # Sólo tienen sentido si el partido es una llave de torneo que hay que
    # definir. En cualquier otro caso la ruta los rechaza.
    home_penalties: Optional[int] = Field(default=None, ge=0, le=50)
    away_penalties: Optional[int] = Field(default=None, ge=0, le=50)
    notes: Optional[str] = None


class MatchResponse(BaseModel):
    id: str
    group_id: str
    group_name: Optional[str] = None
    organizer_id: str
    organizer_name: Optional[str] = None
    title: str
    modality: int
    date: str
    time: str
    location: str
    maps_link: Optional[str] = None
    deadline: str
    status: str
    is_recurring: bool
    max_players: int
    titular_count: int = 0
    suplente_count: int = 0
    created_at: str
    mode: str = DEFAULT_MATCH_MODE
    mode_label: Optional[str] = None
    match_type: str = DEFAULT_MATCH_TYPE
    match_type_label: Optional[str] = None
    # Las capacidades viajan resueltas en la respuesta para que el front no tenga
    # que repetir la tabla de modos. Una sola fuente de verdad: constants.py.
    capabilities: dict = Field(default_factory=dict)
    tracked_stats: List[str] = Field(default_factory=lambda: list(CLASSIC_TRACKED_STATS))
    opponent_name: Optional[str] = None
    # Cuando el partido es la llave de un torneo. Los tres van juntos o ninguno.
    fixture_id: Optional[str] = None
    fixture_side: Optional[Literal["home", "away"]] = None
    tournament_id: Optional[str] = None
    tournament_name: Optional[str] = None
    result: Optional[MatchResultModel] = None
    # Cómo se llaman los dos lados del marcador. Hoy son siempre Equipo A y
    # Equipo B; en modo Entrenador van a ser mi equipo y el rival. Se resuelven
    # en el backend para que la pantalla del resultado no sepa nada del modo.
    home_label: str = "Equipo A"
    away_label: str = "Equipo B"
    # Declarado de verdad y no pasado como kwarg suelto: las rutas ya se lo
    # mandaban al construir la respuesta, pero al no estar declarado pydantic lo
    # descartaba en silencio. Por eso el panel del organizador y
    # utils/permissions.js nunca veían el rol del que mira en el listado.
    my_group_role: Optional[str] = None


class AttendanceEntry(BaseModel):
    player_id: str
    # None borra la marca y devuelve la inscripción a "no se tomó asistencia",
    # que NO es lo mismo que haber faltado (ver jugo_el_partido en constants.py).
    attendance: Optional[Attendance] = None


class SetAttendanceRequest(BaseModel):
    entries: List[AttendanceEntry]


class RegistrationResponse(BaseModel):
    id: str
    match_id: str
    player_id: str
    player_name: str
    player_photo: Optional[str] = None
    player_gender: Optional[Gender] = None
    primary_position: Optional[str] = None
    status: str
    registration_type: Optional[Literal["organizador", "frecuente", "invitado"]] = None
    registered_by: Optional[str] = None
    attendance: Optional[Attendance] = None
    order: int
    registered_at: str


# Team
class TeamAssignmentModel(BaseModel):
    player_id: str
    player_name: str
    player_photo: Optional[str] = None
    player_score: Optional[float] = None
    player_age: Optional[int] = None
    player_gender: Optional[Gender] = None
    team: str
    position: str
    # Titular o banco. Sólo lo usan los modos con banco (ver LINEUP_ROLES); en
    # los demás son todos titulares y el campo no molesta.
    role: Literal["titular", "suplente"] = "titular"
    is_manual: bool = False


class TeamGenerationResponse(BaseModel):
    id: str
    match_id: str
    formation_a: Optional[str] = None
    formation_b: Optional[str] = None
    status: str
    assignments: List[TeamAssignmentModel]
    balance_score: float
    # Diferencia entre el mejor y el peor puntaje del plantel. Viaja para que la
    # pantalla pueda decir "no hay con qué balancear todavía" en vez de mostrar
    # un porcentaje alto calculado sobre jugadores que valen todos lo mismo.
    score_spread: float = 0.0
    created_at: str


class ManualAdjustRequest(BaseModel):
    assignments: List[TeamAssignmentModel]
    formation_a: Optional[str] = None
    formation_b: Optional[str] = None


# Ratings
class PeerRatingRequest(BaseModel):
    rated_player_id: str
    score: int


class PeerRatingBatchRequest(BaseModel):
    ratings: List[PeerRatingRequest]


class SelfEvaluationRequest(BaseModel):
    score: int
    notes: Optional[str] = None


class GroupSeedRatingRequest(BaseModel):
    rated_player_id: str
    score: int


class GroupSeedRatingBatchRequest(BaseModel):
    ratings: List[GroupSeedRatingRequest]


# Stats
class StatsProposalRequest(BaseModel):
    """Propuesta de estadísticas de un jugador, en el modo por consenso.

    `values` es el formato nuevo. Los tres campos sueltos se siguen aceptando
    porque un cliente viejo cacheado en el celular de alguien los va a mandar por
    un rato más, y una propuesta perdida es una discusión en el grupo.
    """

    player_id: str
    values: Optional[Dict[str, int]] = None
    goals: int = 0
    assists: int = 0
    saves: int = 0

    @field_validator("values", mode="after")
    @classmethod
    def _validar_values(cls, value):
        return _limpiar_valores_de_stats(value)

    def valores(self) -> Dict[str, int]:
        """Los valores de la propuesta, sea cual sea el formato en que llegaron."""
        if self.values is not None:
            return dict(self.values)
        sueltos = {"goals": self.goals, "assists": self.assists, "saves": self.saves}
        return {k: v for k, v in sueltos.items() if v}


class PlayerStatsRow(BaseModel):
    player_id: str
    values: Dict[str, int] = Field(default_factory=dict)

    @field_validator("values", mode="after")
    @classmethod
    def _validar_values(cls, value):
        return _limpiar_valores_de_stats(value) or {}


class SetMatchStatsRequest(BaseModel):
    """La planilla entera de una vez, para el modo en que las carga el organizador.

    Va toda junta y no fila por fila porque quien carga ocho métricas de dieciséis
    jugadores las carga de un tirón, mirando la planilla de papel: un pedido por
    fila serían ciento veintiocho idas y vueltas y ninguna forma de saber en cuál
    se cortó.
    """

    rows: List[PlayerStatsRow] = Field(default_factory=list)


class StatsVoteRequest(BaseModel):
    proposal_id: str


class PlayerNoteRequest(BaseModel):
    """Nota del organizador sobre un jugador en un partido.

    El techo de mil caracteres es para que siga siendo una nota. Lo que necesite
    más que eso es una conversación, no un campo de texto.
    """

    text: str = Field(default="", max_length=1000)


# Admin
class UpdateRoleRequest(BaseModel):
    role: UserRole


# Player Metrics
class PlayerMetricsResponse(BaseModel):
    player_id: str
    general_rating: float
    recent_rating: float
    confidence_index: float
    stats_bonus: float
    final_score: float
    position_ratings: dict = Field(default_factory=dict)
    # Cómo le fue en oficiales contra prácticas. Trae su propio `comparable`:
    # con pocos partidos de un tipo la diferencia es ruido y no se muestra.
    match_type_split: dict = Field(default_factory=dict)
    # Cuántos partidos suyos ya tienen resultado cargado. Es la evidencia del
    # canal nuevo del rating.
    result_matches: int = 0
    total_matches: int = 0
    # Los acumulados de TODAS las estadísticas que el jugador tenga cargadas,
    # {stat_id: total}. Los tres campos de abajo son los de siempre y quedan
    # porque hay pantallas que los leen por nombre; salen de acá.
    totals: Dict[str, int] = Field(default_factory=dict)
    total_goals: int = 0
    total_assists: int = 0
    total_saves: int = 0


# Groups
class CreateGroupRequest(BaseModel):
    name: str
    # El modo se elige una vez por grupo y no una vez por partido. Un grupo que
    # juega todos los martes va a elegir siempre lo mismo; pedírselo cincuenta y
    # dos veces al año es fricción pura. Cada partido igual puede pisarlo.
    default_match_mode: MatchMode = DEFAULT_MATCH_MODE


class UpdateGroupRequest(BaseModel):
    default_match_mode: Optional[MatchMode] = None


class GroupResponse(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: str
    default_match_mode: str = DEFAULT_MATCH_MODE
    my_member_role: Optional[GroupMemberRole] = None
    members_count: int = 0


class AddGroupMemberRequest(EmailNormalizedModel):
    player_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[Gender] = None
    username: Optional[str] = None
    member_role: GroupMemberRole = DEFAULT_GROUP_MEMBER_ROLE


class UpdateGroupMemberRequest(BaseModel):
    """Cambiar el rol o el estado de un miembro.

    Antes el endpoint recibía un `dict` pelado y validaba a mano contra una
    lista escrita ahí mismo: quedaba fuera del schema de OpenAPI, fuera de los
    422 del framework, y la lista de roles existía en dos lugares.
    """

    member_role: Optional[GroupMemberRole] = None
    status: Optional[MembershipStatus] = None

    @model_validator(mode="after")
    def _al_menos_uno(self):
        if self.member_role is None and self.status is None:
            raise ValueError("Mandá member_role, status, o los dos")
        return self


class GroupMemberResponse(BaseModel):
    id: str
    group_id: str
    player_id: str
    member_role: GroupMemberRole
    status: MembershipStatus
    invited_by: Optional[str] = None
    created_at: str
    player_name: Optional[str] = None
    player_email: Optional[str] = None
    player_type: Optional[str] = None
    gender: Optional[Gender] = None
    primary_position: Optional[str] = None
    photo_url: Optional[str] = None



# Auth
# Auth
class RegisterRequest(EmailNormalizedModel):
    email: EmailStr
    password: str
    name: str


class RegisterResponse(EmailNormalizedModel):
    message: str
    email: EmailStr
    verification_required: bool = True
    verification_sent: bool = True
    linked_guest_history: bool = False


class LoginRequest(EmailNormalizedModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: str
    role: str
    profile_id: str
    has_profile: bool
    name: str


class VerifyEmailResponse(BaseModel):
    message: str


class ResendVerificationRequest(EmailNormalizedModel):
    email: EmailStr


# Torneos
#
# Un torneo agrupa GRUPOS existentes: cada grupo entra como un equipo y los
# partidos del torneo son grupo contra grupo. Por eso acá no hay jugadores —
# el plantel de cada equipo es la lista de miembros de su grupo.
class CreateTournamentRequest(BaseModel):
    name: str = Field(min_length=3, max_length=80)
    format: TournamentFormat
    group_ids: List[str] = Field(default_factory=list)
    # Sólo se miran en formato "zonas_eliminatoria".
    zones_count: int = 2
    qualifiers_per_zone: int = 2


class AddTournamentTeamRequest(BaseModel):
    group_id: str


class SetFixtureResultRequest(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    # Sólo en las llaves que tienen que definir, y sólo si los noventa minutos
    # terminaron empatados. Las reglas viven en services/fixture_results.
    home_penalties: Optional[int] = Field(default=None, ge=0, le=50)
    away_penalties: Optional[int] = Field(default=None, ge=0, le=50)


class CreateFixtureMatchRequest(BaseModel):
    """El partido de MI grupo para una llave del torneo.

    El grupo va explícito porque quien organiza los dos lados tiene que poder
    elegir de cuál está creando el partido.
    """

    group_id: str
    modality: int
    date: str
    time: str
    location: str
    maps_link: Optional[str] = None
    title: Optional[str] = None


class TournamentTeamResponse(BaseModel):
    id: str
    tournament_id: str
    group_id: str
    name: str
    zone: Optional[str] = None
    seed: int = 0
    members_count: int = 0
    created_at: str


class TournamentFixtureResponse(BaseModel):
    id: str
    tournament_id: str
    stage: str
    stage_label: str
    zone: Optional[str] = None
    round: int
    order: int
    home_team_id: Optional[str] = None
    away_team_id: Optional[str] = None
    home_team_name: Optional[str] = None
    away_team_name: Optional[str] = None
    home_score: Optional[int] = None
    home_penalties: Optional[int] = None
    away_penalties: Optional[int] = None
    away_score: Optional[int] = None
    status: str
    winner_team_id: Optional[str] = None
    created_at: str


class TournamentStandingRow(BaseModel):
    team_id: str
    name: str
    zone: Optional[str] = None
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_diff: int = 0
    points: int = 0


class TournamentResponse(BaseModel):
    id: str
    name: str
    format: str
    format_label: str
    status: str
    zones_count: int = 2
    qualifiers_per_zone: int = 2
    created_by: str
    created_at: str
    teams_count: int = 0
    can_manage: bool = False
    champion_team_id: Optional[str] = None
    champion_name: Optional[str] = None
