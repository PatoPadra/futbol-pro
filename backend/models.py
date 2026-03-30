from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# Auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    user_id: str
    role: str
    profile_id: str
    has_profile: bool
    name: str


# Profile
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[str] = None
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
    player_type: str
    primary_position: Optional[str] = None
    secondary_positions: List[str] = Field(default_factory=list)
    unwanted_position: Optional[str] = None
    matches_played: int = 0
    created_by: Optional[str] = None
    estimated_level: Optional[float] = None
    created_at: str


# Guest
class CreateGuestRequest(BaseModel):
    name: str
    primary_position: Optional[str] = None
    estimated_level: float = 5.0


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


class UpdateMatchRequest(BaseModel):
    title: Optional[str] = None
    modality: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    maps_link: Optional[str] = None
    status: Optional[str] = None


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


class RegistrationResponse(BaseModel):
    id: str
    match_id: str
    player_id: str
    player_name: str
    player_photo: Optional[str] = None
    primary_position: Optional[str] = None
    status: str
    registration_type: Optional[Literal["organizador", "frecuente", "invitado"]] = None
    registered_by: Optional[str] = None
    order: int
    registered_at: str


# Team
class TeamAssignmentModel(BaseModel):
    player_id: str
    player_name: str
    player_photo: Optional[str] = None
    team: str
    position: str
    is_manual: bool = False


class TeamGenerationResponse(BaseModel):
    id: str
    match_id: str
    formation_a: Optional[str] = None
    formation_b: Optional[str] = None
    status: str
    assignments: List[TeamAssignmentModel]
    balance_score: float
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
    player_id: str
    goals: int = 0
    assists: int = 0
    saves: int = 0


class StatsVoteRequest(BaseModel):
    proposal_id: str


# Admin
class UpdateRoleRequest(BaseModel):
    role: str


# Player Metrics
class PlayerMetricsResponse(BaseModel):
    player_id: str
    general_rating: float
    recent_rating: float
    confidence_index: float
    stats_bonus: float
    final_score: float
    position_ratings: dict = Field(default_factory=dict)
    total_matches: int = 0
    total_goals: int = 0
    total_assists: int = 0
    total_saves: int = 0


# Groups
class CreateGroupRequest(BaseModel):
    name: str


class GroupResponse(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: str
    my_member_role: Optional[str] = None
    members_count: int = 0


class AddGroupMemberRequest(BaseModel):
    player_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    member_role: Literal["organizador", "frecuente", "invitado"] = "frecuente"


class GroupMemberResponse(BaseModel):
    id: str
    group_id: str
    player_id: str
    member_role: str
    status: str
    invited_by: Optional[str] = None
    created_at: str
    player_name: Optional[str] = None
    player_email: Optional[str] = None
    player_type: Optional[str] = None
    primary_position: Optional[str] = None
    photo_url: Optional[str] = None
