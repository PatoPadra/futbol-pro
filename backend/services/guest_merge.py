from database import db


async def merge_guest_into_profile(guest_id: str, target_profile_id: str) -> dict | None:
    """Fold an unclaimed guest profile's history into a real player profile, then delete the guest.

    Reassigns every reference to guest_id (match registrations, group memberships,
    ratings, stats, team assignments) so the target keeps its own id — nothing else
    in the app needs to know a merge happened. Guards against duplicate rows when the
    target already has its own registration/membership for the same match/group.
    """
    guest = await db.player_profiles.find_one({"id": guest_id}, {"_id": 0})
    if not guest or guest.get("player_type") != "invitado" or guest.get("user_id"):
        return None

    guest_memberships = await db.group_members.find({"player_id": guest_id}, {"_id": 0}).to_list(200)
    for membership in guest_memberships:
        target_has_membership = await db.group_members.find_one(
            {"group_id": membership["group_id"], "player_id": target_profile_id, "status": "activo"},
            {"_id": 0},
        )
        if target_has_membership:
            await db.group_members.delete_one({"id": membership["id"]})
        else:
            await db.group_members.update_one(
                {"id": membership["id"]}, {"$set": {"player_id": target_profile_id}}
            )

    guest_registrations = await db.match_registrations.find({"player_id": guest_id}, {"_id": 0}).to_list(500)
    for reg in guest_registrations:
        target_has_active_reg = await db.match_registrations.find_one(
            {"match_id": reg["match_id"], "player_id": target_profile_id, "status": {"$ne": "baja"}},
            {"_id": 0},
        )
        if target_has_active_reg and reg.get("status") != "baja":
            await db.match_registrations.delete_one({"id": reg["id"]})
        else:
            await db.match_registrations.update_one(
                {"id": reg["id"]}, {"$set": {"player_id": target_profile_id}}
            )

    await db.peer_ratings.update_many(
        {"rated_player_id": guest_id}, {"$set": {"rated_player_id": target_profile_id}}
    )
    await db.group_seed_ratings.update_many(
        {"rated_player_id": guest_id}, {"$set": {"rated_player_id": target_profile_id}}
    )
    await db.stats_proposals.update_many(
        {"player_id": guest_id}, {"$set": {"player_id": target_profile_id}}
    )
    await db.stats_final.update_many(
        {"player_id": guest_id}, {"$set": {"player_id": target_profile_id}}
    )
    await db.team_generations.update_many(
        {"assignments.player_id": guest_id},
        {"$set": {"assignments.$[elem].player_id": target_profile_id}},
        array_filters=[{"elem.player_id": guest_id}],
    )

    if guest.get("matches_played"):
        await db.player_profiles.update_one(
            {"id": target_profile_id}, {"$inc": {"matches_played": guest["matches_played"]}}
        )

    await db.player_profiles.delete_one({"id": guest_id})
    return guest
