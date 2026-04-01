import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Filter, Plus, Search, Shield, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import GroupMemberCard from '@/components/groups/GroupMemberCard';
import PageLoader from '@/components/common/PageLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'frecuente', label: 'Frecuentes' },
  { value: 'invitado', label: 'Invitados' },
  { value: 'organizador', label: 'Organizadores' },
];

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingRatings, setSavingRatings] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [inviteForm, setInviteForm] = useState({
    name: '',
    username: '',
    email: '',
    member_role: 'frecuente',
  });
  const [ratingMap, setRatingMap] = useState({});

  const loadData = async ({ keepLoader = false } = {}) => {
    if (!keepLoader) setLoading(true);
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

  const myProfileId = user?.profile?.id || user?.profile_id;
  const canInvite = Boolean(group?.can_invite || user?.role === 'admin');
  const canManage = Boolean(group?.can_manage || user?.role === 'admin');
  const canRate = Boolean(group?.can_rate_seed || user?.role === 'admin');

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const text = `${member.player_name || ''} ${member.player_email || ''} ${member.primary_position || ''}`.toLowerCase();
      const searchMatch = !search.trim() || text.includes(search.trim().toLowerCase());

      let filterMatch = true;
      if (filter === 'frecuente') filterMatch = member.membership_type === 'frecuente';
      if (filter === 'invitado') filterMatch = member.membership_type === 'invitado';
      if (filter === 'organizador') filterMatch = member.group_permission === 'organizador';

      return searchMatch && filterMatch;
    });
  }, [members, search, filter]);

  const rateableMembers = useMemo(() => {
    return members.filter((member) => {
      if (member.player_id === myProfileId) return false;

      const isCoreMember = member.membership_type === 'frecuente';
      const isMyInvitedGuest = member.membership_type === 'invitado' && member.invited_by === myProfileId;

      return isCoreMember || isMyInvitedGuest;
    });
  }, [members, myProfileId]);

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
      await loadData({ keepLoader: true });
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
      await loadData({ keepLoader: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar puntajes');
    } finally {
      setSavingRatings(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const confirmed = window.confirm(`¿Querés quitar a ${member.player_name} del grupo? También se lo dará de baja de los partidos activos de este grupo.`);
    if (!confirmed) return;

    setMemberActionLoading(member.id);
    try {
      await api.delete(`/groups/${id}/members/${member.id}`);
      toast.success('Jugador quitado del grupo');
      await loadData({ keepLoader: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo quitar al jugador');
    } finally {
      setMemberActionLoading('');
    }
  };


  const handleDeleteGroup = async () => {
    const confirmed = window.confirm(`¿Querés borrar definitivamente el grupo ${group.name}? También se borrarán sus partidos y equipos.`);
    if (!confirmed) return;

    try {
      await api.delete(`/groups/${id}`);
      toast.success('Grupo borrado');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo borrar el grupo');
    }
  };

  if (loading) return <PageLoader />;
  if (!group) return <div className="page-container text-center text-slate-500">Grupo no encontrado</div>;

  const totalGuests = members.filter((m) => m.membership_type === 'invitado').length;
  const totalOrganizers = members.filter((m) => m.group_permission === 'organizador').length;

  return (
    <div className="page-container max-w-6xl mx-auto" data-testid="group-detail-page">
      <div className="animate-slide-up space-y-6">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Badge variant="outline">{group.members_count} activos</Badge>
                <Badge variant="outline">
                  {GROUP_PERMISSION_LABELS[group.my_group_permission] || group.my_group_permission}
                </Badge>
                <Badge variant="outline">
                  {MEMBERSHIP_TYPE_LABELS[group.my_membership_type] || group.my_membership_type}
                </Badge>
                {group.my_global_role === 'admin' && (
                  <Badge className="bg-slate-900 text-white">
                    <Shield className="w-3 h-3 mr-1" /> Admin
                  </Badge>
                )}
              </div>

              <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">
                {group.name}
              </h1>
              <p className="text-slate-500 mt-2 max-w-2xl">
                Gestioná el plantel del grupo, cargá puntajes iniciales y prepará el próximo partido desde acá.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/partidos/crear?group_id=${group.id}`}>
                <Button className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase">
                  <Plus className="w-4 h-4 mr-2" /> Crear Partido
                </Button>
              </Link>
              {canManage && (
                <Button variant="outline" onClick={handleDeleteGroup} className="rounded-full border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" /> Borrar Grupo
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Miembros</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{group.members_count}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Organizan</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalOrganizers}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Invitados</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalGuests}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-100 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Tu rol</p>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {GROUP_PERMISSION_LABELS[group.my_group_permission] || group.my_group_permission}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6 items-start">
          <div className="space-y-6">
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                      <Users className="w-4 h-4" /> Miembros del grupo
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Tocá la foto para verla más grande.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                    {filteredMembers.length} visibles
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, email o posición"
                      className="pl-9 bg-slate-50"
                      data-testid="group-member-search"
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="bg-slate-50" data-testid="group-member-filter">
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                    No encontramos miembros con ese filtro.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMembers.map((member) => (
                      <GroupMemberCard
                        key={member.id}
                        member={member}
                        canManage={canManage}
                        canRemove={member.player_id !== myProfileId && memberActionLoading !== member.id}
                        onRemove={() => handleRemoveMember(member)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {canRate && (
              <Card className="border-slate-100 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Star className="w-4 h-4" /> Puntaje inicial del grupo
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Los jugadores frecuentes pueden puntuar a los demás frecuentes. Los invitados solo pueden ser puntuados por quien los invitó.
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {rateableMembers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                      No hay compañeros elegibles para puntuar todavía.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rateableMembers.map((member) => (
                        <div
                          key={member.player_id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{member.player_name}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
                              {' · '}
                              {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
                              {member.membership_type === 'invitado' && member.invited_by === myProfileId
                                ? ' · Tu invitado'
                                : ''}
                            </p>
                          </div>

                          <Input
                            type="number"
                            min="1"
                            max="10"
                            step="1"
                            value={ratingMap[member.player_id] || ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRatingMap((prev) => ({ ...prev, [member.player_id]: value }));
                            }}
                            className="w-20 text-center bg-slate-50"
                            data-testid={`seed-rating-${member.player_id}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleSaveRatings}
                    disabled={savingRatings || rateableMembers.length === 0}
                    className="w-full bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase"
                    data-testid="save-seed-ratings"
                  >
                    {savingRatings ? 'Guardando...' : 'Guardar puntajes iniciales'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {canInvite && (
              <Card className="border-slate-100 shadow-sm sticky top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg uppercase">Agregar jugador</CardTitle>
                  <p className="text-sm text-slate-500">Podés sumar jugadores frecuentes o invitados al grupo.</p>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-name">Nombre</Label>
                      <Input
                        id="invite-name"
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Ej: Juan Pérez"
                        className="bg-slate-50"
                        data-testid="group-invite-name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-username">Usuario exacto</Label>
                      <Input
                        id="invite-username"
                        value={inviteForm.username}
                        onChange={(event) => setInviteForm((prev) => ({ ...prev, username: event.target.value }))}
                        placeholder="Si ya existe en la app"
                        className="bg-slate-50"
                        data-testid="group-invite-username"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="email@jugador.com"
                        className="bg-slate-50"
                        data-testid="group-invite-email"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Tipo de miembro</Label>
                      <Select
                        value={inviteForm.member_role}
                        onValueChange={(value) => setInviteForm((prev) => ({ ...prev, member_role: value }))}
                      >
                        <SelectTrigger className="bg-slate-50" data-testid="group-invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="frecuente">Frecuente</SelectItem>
                          <SelectItem value="invitado">Invitado</SelectItem>
                          <SelectItem value="organizador">Organizador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingInvite}
                      className="w-full bg-turf hover:bg-turf-dark text-white rounded-xl font-bold uppercase"
                      data-testid="group-invite-submit"
                    >
                      {savingInvite ? 'Agregando...' : 'Agregar al grupo'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
