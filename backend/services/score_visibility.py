from constants import puede_organizar
from database import db
from services.matches import get_match_or_404
from services.profiles import get_my_profile_or_404


async def get_score_visibility_for_group(group_id: str, user):
    if user["role"] == "admin":
        return {
            "can_view_all_scores": True,
            "can_view_peer_scores": True,
            "can_view_self_scores": True,
            "scope": "admin",
        }

    profile = await get_my_profile_or_404(user)
    membership = await db.group_members.find_one(
        {"group_id": group_id, "player_id": profile["id"], "status": "activo"},
        {"_id": 0},
    )

    is_organizer = bool(membership and puede_organizar(membership.get("member_role")))
    return {
        "can_view_all_scores": is_organizer,
        "can_view_peer_scores": is_organizer,
        "can_view_self_scores": True,
        "scope": "organizer" if is_organizer else "self_only",
    }


async def get_score_visibility_for_match(match_id: str, user):
    match = await get_match_or_404(match_id)
    visibility = await get_score_visibility_for_group(match["group_id"], user)
    return match, visibility


async def get_score_visibility_for_player(target_player_id: str, user):
    if user["role"] == "admin":
        profile = await get_my_profile_or_404(user)
        return {
            "requester_profile_id": profile["id"],
            "can_view_all_scores": True,
            "can_view_peer_scores": True,
            "can_view_self_scores": profile["id"] == target_player_id,
            "scope": "admin",
        }

    profile = await get_my_profile_or_404(user)
    requester_id = profile["id"]
    if requester_id == target_player_id:
        return {
            "requester_profile_id": requester_id,
            "can_view_all_scores": False,
            "can_view_peer_scores": False,
            "can_view_self_scores": True,
            "scope": "self_only",
        }

    organizer_memberships = await db.group_members.find(
        {"player_id": requester_id, "status": "activo", "member_role": "organizador"},
        {"_id": 0},
    ).to_list(500)
    organizer_group_ids = [m["group_id"] for m in organizer_memberships]

    if organizer_group_ids:
        shared_target_membership = await db.group_members.find_one(
            {
                "group_id": {"$in": organizer_group_ids},
                "player_id": target_player_id,
                "status": "activo",
            },
            {"_id": 0},
        )
        if shared_target_membership:
            return {
                "requester_profile_id": requester_id,
                "can_view_all_scores": True,
                "can_view_peer_scores": True,
                "can_view_self_scores": False,
                "scope": "organizer",
            }

    return {
        "requester_profile_id": requester_id,
        "can_view_all_scores": False,
        "can_view_peer_scores": False,
        "can_view_self_scores": False,
        "scope": "restricted",
    }
