import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, Star, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getGroupPermissionLabel, getMembershipTypeLabel } from '../constants/groups';
import { canInviteToGroup, canRateSeed } from '../utils/permissions';
import { getProfileId, isAdmin } from '../utils/user';
import GroupMemberCard from '../components/groups/GroupMemberCard';
import InviteMemberForm from '../components/groups/InviteMemberForm';
import SeedRatingRow from '../components/groups/SeedRatingRow';
import PageLoader from '../components/common/PageLoader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const INITIAL_INVITE_FORM = {
  name: '',
  username: '',
  email: '',
  member_role: 'frecuente',
};

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingRatings, setSavingRatings] = useState(false);
  const [inviteForm, setInviteForm] = useState(INITIAL_INVITE_FORM);
  const [ratingMap, setRatingMap] = useState({});

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    try {
      const [groupRes, membersRes, ratingsRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/groups/${id}/members`),
        api.get(`/groups/${id}/seed-ratings`).catch(() => ({ data: { my_ratings: [] } })),
      ]);

      setGroup(groupRes.data);
      setMembers(membersRes.data || []);

      const initialMap = {};
      (ratingsRes.data?.my_ratings || []).forEach((rating) => {
        initialMap[rating.rated_player_id] = String(rating.score);
      });
      setRatingMap(initialMap);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cargar grupo');
    } finally {
      setLoading(false);
    }
  }

  const myProfileId = getProfileId(user);
  const allowInvite = canInviteToGroup(group, user);
  const allowSeedRating = canRateSeed(group, user);

  const rateableMembers = useMemo(
    () =>
      members.filter((member) => {
        if (member.player_id === myProfileId) return false;

        const isCoreMember = member.membership_type === 'frecuente';
        const isMyInvitedGuest = member.membership_type === 'invitado' && member.invited_by === myProfileId;

        return isCoreMember || isMyInvitedGuest;
      }),
    [members, myProfileId],
  );

  const handleInviteFormChange = (field, value) => {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setSavingInvite(true);

    try {
      const payload = {
        name: inviteForm.name || null,
        username: inviteForm.username || null,
        email: inviteForm.email || null,
        member_role: inviteForm.member_role,
      };

      await api.post(`/groups/${id}/members`, payload);
      toast.success('Jugador agregado al grupo');
      setInviteForm(INITIAL_INVITE_FORM);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al invitar jugador');
    } finally {
      setSavingInvite(false);
    }
  };

  const handleSaveRatings = async () => {
    const ratings = Object.entries(ratingMap)
      .filter(([, score]) => score !== '' && !Number.isNaN(Number(score)))
      .map(([rated_player_id, score]) => ({ rated_player_id, score: Number(score) }));

    if (ratings.length === 0) {
      toast.error('No hay puntajes para guardar');
      return;
    }

    setSavingRatings(true);
    try {
      await api.post(`/groups/${id}/seed-ratings`, { ratings });
      toast.success('Puntajes iniciales guardados');
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar puntajes');
    } finally {
      setSavingRatings(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!group) {
    return <div className="page-container text-center text-slate-500">Grupo no encontrado</div>;
  }

  return (
    <div className="page-container max-w-5xl mx-auto" data-testid="group-detail-page">
      <div className="animate-slide-up space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">{group.name}</h1>
            <p className="text-slate-500 mt-1">{group.members_count} miembros activos</p>

            <div className="flex items-center gap-2 flex-wrap mt-3">
              <Badge variant="outline">{getGroupPermissionLabel(group.my_group_permission)}</Badge>
              <Badge variant="outline">{getMembershipTypeLabel(group.my_membership_type)}</Badge>
              {(group.my_global_role === 'admin' || isAdmin(user)) && (
                <Badge className="bg-slate-900 text-white">
                  <Shield className="w-3 h-3 mr-1" /> Admin
                </Badge>
              )}
            </div>
          </div>

          <Link to={`/partidos/crear?group_id=${group.id}`}>
            <Button className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
              Crear Partido
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-100">
              <CardHeader>
                <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                  <Users className="w-4 h-4" /> Miembros del grupo
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {members.map((member) => (
                  <GroupMemberCard key={member.id} member={member} />
                ))}
              </CardContent>
            </Card>

            {allowSeedRating && (
              <Card className="border-slate-100">
                <CardHeader>
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Star className="w-4 h-4" /> Puntaje inicial del grupo
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Los jugadores frecuentes del grupo pueden puntuar a los demás frecuentes. Los invitados solo pueden ser puntuados por quien los invitó.
                  </p>

                  {rateableMembers.length === 0 && (
                    <p className="text-sm text-slate-400">No hay compañeros elegibles para puntuar todavía.</p>
                  )}

                  <div className="space-y-3">
                    {rateableMembers.map((member) => (
                      <SeedRatingRow
                        key={member.player_id}
                        member={member}
                        isInvitedByMe={member.invited_by === myProfileId}
                        value={ratingMap[member.player_id]}
                        onChange={(value) =>
                          setRatingMap((prev) => ({
                            ...prev,
                            [member.player_id]: value,
                          }))
                        }
                      />
                    ))}
                  </div>

                  <Button
                    onClick={handleSaveRatings}
                    disabled={savingRatings || rateableMembers.length === 0}
                    className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase"
                  >
                    {savingRatings ? 'Guardando...' : 'Guardar Puntajes Iniciales'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {allowInvite && (
              <InviteMemberForm
                form={inviteForm}
                onFormChange={handleInviteFormChange}
                onSubmit={handleInvite}
                saving={savingInvite}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
