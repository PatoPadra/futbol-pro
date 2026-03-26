import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Shield, Star, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import PageLoader from '../components/common/PageLoader';
import GroupMemberCard from '../components/groups/GroupMemberCard';
import InviteMemberForm from '../components/groups/InviteMemberForm';
import SeedRatingRow from '../components/groups/SeedRatingRow';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '../constants/groups';
import { canInviteToGroup, canRateSeed } from '../utils/permissions';
import { getProfileId } from '../utils/user';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingRatings, setSavingRatings] = useState(false);
  const [memberFilter, setMemberFilter] = useState('todos');
  const [inviteForm, setInviteForm] = useState({
    name: '',
    username: '',
    email: '',
    member_role: 'frecuente',
  });
  const [ratingMap, setRatingMap] = useState({});

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const myProfileId = getProfileId(user);
  const canInvite = canInviteToGroup(group, user);
  const canRate = canRateSeed(group, user);

  const filteredMembers = useMemo(() => {
    if (memberFilter === 'frecuentes') {
      return members.filter((member) => member.membership_type === 'frecuente');
    }
    if (memberFilter === 'invitados') {
      return members.filter((member) => member.membership_type === 'invitado');
    }
    if (memberFilter === 'organizadores') {
      return members.filter((member) => member.group_permission === 'organizador');
    }
    return members;
  }, [memberFilter, members]);

  const rateableMembers = useMemo(() => {
    return members.filter((member) => {
      if (member.player_id === myProfileId) return false;

      const isCoreMember = member.membership_type === 'frecuente';
      const isMyInvitedGuest = member.membership_type === 'invitado' && member.invited_by === myProfileId;

      return isCoreMember || isMyInvitedGuest;
    });
  }, [members, myProfileId]);

  const memberStats = useMemo(() => {
    return {
      frecuentes: members.filter((member) => member.membership_type === 'frecuente').length,
      invitados: members.filter((member) => member.membership_type === 'invitado').length,
      organizadores: members.filter((member) => member.group_permission === 'organizador').length,
    };
  }, [members]);

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
      setInviteForm({ name: '', username: '', email: '', member_role: 'frecuente' });
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

  if (loading) {
    return <PageLoader label="Cargando grupo..." />;
  }

  if (!group) {
    return <div className="page-container text-center text-slate-500">Grupo no encontrado</div>;
  }

  return (
    <div className="page-container max-w-6xl mx-auto" data-testid="group-detail-page">
      <div className="animate-slide-up space-y-6">
        <section className="rounded-[28px] border border-slate-100 bg-white p-6 md:p-7 shadow-sm shadow-slate-100/80">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant="outline">
                  {GROUP_PERMISSION_LABELS[group.my_group_permission] || group.my_group_permission}
                </Badge>
                <Badge variant="outline">
                  {MEMBERSHIP_TYPE_LABELS[group.my_membership_type] || group.my_membership_type}
                </Badge>
                {user?.role === 'admin' && (
                  <Badge className="bg-slate-900 text-white">
                    <Shield className="w-3 h-3 mr-1" /> Admin
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-3xl md:text-5xl font-bold uppercase tracking-tight text-slate-900">
                {group.name}
              </h1>
              <p className="text-slate-500 mt-2 max-w-2xl">
                Organiza jugadores frecuentes, invitados y puntajes iniciales desde una sola pantalla.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/organizador">
                <Button variant="outline" className="rounded-full px-5">
                  Panel organizador
                </Button>
              </Link>
              <Link to={`/partidos/crear?group_id=${group.id}`}>
                <Button className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
                  Crear partido
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Miembros activos', value: group.members_count },
              { label: 'Frecuentes', value: memberStats.frecuentes },
              { label: 'Invitados', value: memberStats.invitados },
              { label: 'Organizadores', value: memberStats.organizadores },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <Card className="border-slate-100 shadow-sm shadow-slate-100/70">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Users className="w-4 h-4" /> Miembros del grupo
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Filtrá rápido para ver quiénes son frecuentes, invitados o quién organiza.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ['todos', `Todos (${members.length})`],
                    ['frecuentes', `Frecuentes (${memberStats.frecuentes})`],
                    ['invitados', `Invitados (${memberStats.invitados})`],
                    ['organizadores', `Organizadores (${memberStats.organizadores})`],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={memberFilter === key ? 'default' : 'outline'}
                      onClick={() => setMemberFilter(key)}
                      className={`rounded-full ${memberFilter === key ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {filteredMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                    No hay jugadores para este filtro.
                  </div>
                ) : (
                  filteredMembers.map((member) => <GroupMemberCard key={member.id} member={member} />)
                )}
              </CardContent>
            </Card>

            {canRate && (
              <Card className="border-slate-100 shadow-sm shadow-slate-100/70">
                <CardHeader>
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Star className="w-4 h-4" /> Puntaje inicial del grupo
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-orange/5 border border-orange/10 p-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Los frecuentes pueden puntuar a los demás frecuentes. Los invitados solo pueden ser puntuados por quien los invitó.
                    </p>
                  </div>

                  {rateableMembers.length === 0 && (
                    <p className="text-sm text-slate-400">No hay compañeros elegibles para puntuar todavía.</p>
                  )}

                  <div className="space-y-3">
                    {rateableMembers.map((member) => (
                      <SeedRatingRow
                        key={member.player_id}
                        member={member}
                        myProfileId={myProfileId}
                        value={ratingMap[member.player_id]}
                        onChange={(e) =>
                          setRatingMap((prev) => ({
                            ...prev,
                            [member.player_id]: e.target.value,
                          }))
                        }
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-slate-400">
                      Consejo: usá una escala consistente para que el balanceador tenga mejor base.
                    </p>
                    <Button
                      onClick={handleSaveRatings}
                      disabled={savingRatings || rateableMembers.length === 0}
                      className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase"
                    >
                      {savingRatings ? 'Guardando...' : 'Guardar puntajes iniciales'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {canInvite && (
              <InviteMemberForm
                inviteForm={inviteForm}
                setInviteForm={setInviteForm}
                savingInvite={savingInvite}
                onSubmit={handleInvite}
              />
            )}

            <Card className="border-slate-100 shadow-sm shadow-slate-100/70">
              <CardHeader>
                <CardTitle className="font-heading text-lg uppercase">Siguiente paso recomendado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Con el grupo listo, lo más práctico es crear el próximo partido ya vinculado a este grupo.
                </p>
                <Link to={`/partidos/crear?group_id=${group.id}`}>
                  <Button className="w-full bg-turf hover:bg-turf-dark text-white rounded-full font-bold uppercase">
                    Crear partido <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
