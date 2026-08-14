import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import GroupMemberCard from '@/components/groups/GroupMemberCard';
import LinkGuestDialog from '@/components/groups/LinkGuestDialog';
import PageLoader from '@/components/common/PageLoader';
import StatTile from '@/components/common/StatTile';
import { getRatingTone } from '@/utils/ratings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'frecuente', label: 'Frecuentes' },
  { value: 'invitado', label: 'Invitados' },
  { value: 'organizador', label: 'Organizadores' },
];


const inviteMemberSchema = z
  .object({
    name: z.string().trim().max(80, 'Nombre demasiado largo').optional().or(z.literal('')),
    username: z.string().trim().max(50, 'Usuario demasiado largo').optional().or(z.literal('')),
    email: z.string().trim().email('Ingresá un email válido').optional().or(z.literal('')),
    member_role: z.enum(['frecuente', 'invitado', 'organizador']),
  })
  .refine((data) => Boolean(data.email || data.username || data.name), {
    message: 'Ingresá un email, usuario o nombre para poder agregarlo',
    path: ['name'],
  });

const inviteDefaultValues = { name: '', username: '', email: '', member_role: 'frecuente' };

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingRatings, setSavingRatings] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [ratingMap, setRatingMap] = useState({});
  const [inviteServerError, setInviteServerError] = useState('');
  const [memberPendingRemoval, setMemberPendingRemoval] = useState(null);
  const [linkGuestTarget, setLinkGuestTarget] = useState(null);
  const [confirmDeleteGroupOpen, setConfirmDeleteGroupOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const {
    register: registerInvite,
    handleSubmit: handleInviteSubmit,
    control: inviteControl,
    reset: resetInviteForm,
    formState: { errors: inviteErrors, isSubmitting: savingInvite },
  } = useForm({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: inviteDefaultValues,
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const myProfileId = user?.profile?.id || user?.profile_id;
  const isAdmin = user?.role === 'admin' || group?.my_global_role === 'admin';

  // Trust the backend as the single source of truth for permissions instead of
  // re-deriving them client-side — avoids drift between what the UI shows and
  // what the API will actually allow.
  const canInvite = Boolean(group?.can_invite);
  const canManage = Boolean(group?.can_manage);
  const canRate = Boolean(group?.can_rate_seed);

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

  const guestMembers = useMemo(
    () => members.filter((member) => member.membership_type === 'invitado'),
    [members]
  );

  const rateableMembers = useMemo(() => {
    return members.filter((member) => {
      if (member.player_id === myProfileId) return false;

      const isCoreMember = member.membership_type === 'frecuente';
      const isMyInvitedGuest = member.membership_type === 'invitado' && member.invited_by === myProfileId;

      return isCoreMember || isMyInvitedGuest;
    });
  }, [members, myProfileId]);

  const ratingErrors = useMemo(() => {
    const errs = {};
    Object.entries(ratingMap).forEach(([playerId, value]) => {
      if (value === '' || value === undefined || value === null) return;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 10) {
        errs[playerId] = 'Entre 1 y 10';
      }
    });
    return errs;
  }, [ratingMap]);

  const hasRatingErrors = Object.keys(ratingErrors).length > 0;

  const onInviteSubmit = async (data) => {
    setInviteServerError('');
    try {
      const payload = {
        name: data.name || null,
        username: data.username || null,
        email: data.email || null,
        member_role: data.member_role,
      };

      await api.post(`/groups/${id}/members`, payload);
      toast.success('Jugador agregado al grupo');
      resetInviteForm(inviteDefaultValues);
      await loadData({ keepLoader: true });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al invitar jugador';
      setInviteServerError(msg);
      toast.error(msg);
    }
  };

  const handleSaveRatings = async () => {
    if (hasRatingErrors) {
      toast.error('Corregí los puntajes fuera de rango (entre 1 y 10) antes de guardar');
      return;
    }

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

  const requestRemoveMember = (member) => setMemberPendingRemoval(member);

  const confirmRemoveMember = async () => {
    const member = memberPendingRemoval;
    if (!member) return;

    setMemberActionLoading(member.id);
    try {
      await api.delete(`/groups/${id}/members/${member.id}`);
      toast.success('Jugador quitado del grupo');
      setMemberPendingRemoval(null);
      await loadData({ keepLoader: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo quitar al jugador');
    } finally {
      setMemberActionLoading('');
    }
  };

  const requestDeleteGroup = () => setConfirmDeleteGroupOpen(true);

  const confirmDeleteGroup = async () => {
    setDeletingGroup(true);
    try {
      await api.delete(`/groups/${id}`);
      toast.success('Grupo borrado');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo borrar el grupo');
      setDeletingGroup(false);
      setConfirmDeleteGroupOpen(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setFilter('todos');
  };

  if (loading) return <PageLoader />;

  if (!group) {
    return (
      <div className="page-container" data-testid="group-not-found">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-tight text-slate-900 mb-2">
            Grupo no encontrado
          </h2>
          <p className="text-slate-500 mb-6 max-w-sm">
            Puede que haya sido borrado o que no tengas acceso a él.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => loadData()}
              shape="pill"
              className="h-11 px-6 border-2 border-slate-200 hover:border-slate-400"
              data-testid="group-not-found-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
            </Button>
            <Link to="/dashboard">
              <Button shape="pill" className="h-11 px-6 bg-turf hover:bg-turf-dark text-white" data-testid="group-not-found-back">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
                {isAdmin && (
                  <Badge variant="charcoal">
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

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Link to={`/partidos/crear?group_id=${group.id}`} data-testid="group-create-match-link">
                  <Button
                    shape="pill"
                    className="h-12 px-6 bg-turf hover:bg-turf-dark text-white shadow-lg shadow-turf/20"
                    data-testid="group-create-match-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Crear Partido
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={requestDeleteGroup}
                  shape="pill"
                  className="h-12 px-6 border-2 border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive"
                  data-testid="group-delete-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Borrar Grupo
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <StatTile icon={Users} value={group.members_count} label="Miembros" />
            <StatTile icon={Shield} value={totalOrganizers} label="Organizan" />
            <StatTile icon={UserPlus} value={totalGuests} label="Invitados" tone="orange" />
            <StatTile
              icon={Star}
              value={GROUP_PERMISSION_LABELS[group.my_group_permission] || group.my_group_permission}
              label="Tu rol"
            />
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
                      aria-label="Buscar miembros por nombre, email o posición"
                      className="pl-9 h-12 bg-slate-50 border-slate-200 focus:border-turf focus:ring-2 focus:ring-turf/20 rounded-lg"
                      data-testid="group-member-search"
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger
                      className="h-12 bg-slate-50 border-slate-200 focus:border-turf focus:ring-2 focus:ring-turf/20 rounded-lg"
                      aria-label="Filtrar miembros"
                      data-testid="group-member-filter"
                    >
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
                  <div
                    className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500"
                    data-testid="group-members-empty"
                  >
                    {members.length === 0 ? (
                      <>
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p>Este grupo todavía no tiene miembros.</p>
                        {canInvite && (
                          <p className="text-sm mt-1">Sumá al primero desde el panel de la derecha.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p>No encontramos miembros con ese filtro.</p>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={clearFilters}
                          className="mt-3 h-11 text-turf hover:text-turf-dark font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                          data-testid="group-clear-filters"
                        >
                          Limpiar filtros
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className={
                          memberActionLoading === member.id
                            ? 'opacity-60 pointer-events-none transition-opacity'
                            : 'transition-opacity'
                        }
                        aria-busy={memberActionLoading === member.id}
                      >
                        <GroupMemberCard
                          member={member}
                          canManage={canManage}
                          canRemove={member.player_id !== myProfileId}
                          onRemove={() => requestRemoveMember(member)}
                          onLinkGuest={
                            canManage && member.membership_type !== 'invitado' && guestMembers.length > 0
                              ? () => setLinkGuestTarget(member)
                              : undefined
                          }
                        />
                      </div>
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
                      <Star className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                      No hay compañeros elegibles para puntuar todavía.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rateableMembers.map((member) => (
                        <div
                          key={member.player_id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{member.player_name}</p>
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              {GROUP_PERMISSION_LABELS[member.group_permission] || member.group_permission}
                              {' · '}
                              {MEMBERSHIP_TYPE_LABELS[member.membership_type] || member.membership_type}
                              {member.membership_type === 'invitado' && member.invited_by === myProfileId
                                ? ' · Tu invitado'
                                : ''}
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col items-end gap-1">
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
                              aria-label={`Puntaje inicial para ${member.player_name}`}
                              aria-invalid={!!ratingErrors[member.player_id]}
                              className={`w-20 h-11 text-center font-semibold ${
                                ratingErrors[member.player_id]
                                  ? 'border-red-300 focus-visible:ring-red-300 bg-slate-50'
                                  : ratingMap[member.player_id]
                                    ? `${getRatingTone(Number(ratingMap[member.player_id])).text} ${getRatingTone(Number(ratingMap[member.player_id])).bg}`
                                    : 'bg-slate-50'
                              }`}
                              data-testid={`seed-rating-${member.player_id}`}
                            />
                            {ratingErrors[member.player_id] && (
                              <span className="text-[11px] text-red-600">{ratingErrors[member.player_id]}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleSaveRatings}
                    disabled={savingRatings || rateableMembers.length === 0 || hasRatingErrors}
                    shape="pill"
                    className="w-full h-12 bg-turf hover:bg-turf-dark text-white"
                    data-testid="save-seed-ratings"
                  >
                    {savingRatings && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    {savingRatings ? 'Guardando...' : 'Guardar puntajes iniciales'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {canInvite && (
              <Card className="border-slate-100 shadow-sm xl:sticky xl:top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg uppercase">Agregar jugador</CardTitle>
                  <p className="text-sm text-slate-500">Podés sumar jugadores frecuentes o invitados al grupo.</p>
                </CardHeader>

                <CardContent>
                  <form
                    onSubmit={handleInviteSubmit(onInviteSubmit)}
                    className="space-y-4"
                    noValidate
                    data-testid="group-invite-form"
                  >
                    {inviteServerError && (
                      <div
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                        role="alert"
                        aria-live="polite"
                        data-testid="group-invite-server-error"
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{inviteServerError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-name">Nombre</Label>
                      <Input
                        id="invite-name"
                        placeholder="Ej: Juan Pérez"
                        aria-invalid={!!inviteErrors.name}
                        className={`h-12 bg-slate-50 ${inviteErrors.name ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                        data-testid="group-invite-name"
                        {...registerInvite('name')}
                      />
                      {inviteErrors.name && (
                        <p className="text-xs text-red-600" data-testid="group-invite-name-error">
                          {inviteErrors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-username">Usuario exacto</Label>
                      <Input
                        id="invite-username"
                        placeholder="Si ya existe en la app"
                        aria-invalid={!!inviteErrors.username}
                        className={`h-12 bg-slate-50 ${inviteErrors.username ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                        data-testid="group-invite-username"
                        {...registerInvite('username')}
                      />
                      {inviteErrors.username && (
                        <p className="text-xs text-red-600" data-testid="group-invite-username-error">
                          {inviteErrors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="email@jugador.com"
                        aria-invalid={!!inviteErrors.email}
                        className={`h-12 bg-slate-50 ${inviteErrors.email ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                        data-testid="group-invite-email"
                        {...registerInvite('email')}
                      />
                      {inviteErrors.email && (
                        <p className="text-xs text-red-600" data-testid="group-invite-email-error">
                          {inviteErrors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invite-role">Tipo de miembro</Label>
                      <Controller
                        control={inviteControl}
                        name="member_role"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="invite-role" className="h-12 bg-slate-50" data-testid="group-invite-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="frecuente">Frecuente</SelectItem>
                              <SelectItem value="invitado">Invitado</SelectItem>
                              <SelectItem value="organizador">Organizador</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={savingInvite}
                      shape="pill"
                    className="w-full h-12 bg-turf hover:bg-turf-dark text-white"
                      data-testid="group-invite-submit"
                    >
                      {savingInvite && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      {savingInvite ? 'Agregando...' : 'Agregar al grupo'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!memberPendingRemoval}
        onOpenChange={(open) => !open && !memberActionLoading && setMemberPendingRemoval(null)}
      >
        <AlertDialogContent className="rounded-2xl" data-testid="remove-member-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {memberPendingRemoval?.player_name} del grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              También se lo va a dar de baja de los partidos activos de este grupo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="remove-member-cancel"
              disabled={!!memberActionLoading}
              className="rounded-full font-bold uppercase tracking-wide"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRemoveMember();
              }}
              disabled={!!memberActionLoading}
              className="rounded-full font-bold uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="remove-member-confirm"
            >
              {memberActionLoading ? 'Quitando...' : 'Quitar del grupo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteGroupOpen}
        onOpenChange={(open) => !open && !deletingGroup && setConfirmDeleteGroupOpen(false)}
      >
        <AlertDialogContent className="rounded-2xl" data-testid="delete-group-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              ¿Borrar el grupo {group.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se van a borrar también sus partidos y equipos generados. Esta acción es definitiva y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-group-cancel"
              disabled={deletingGroup}
              className="rounded-full font-bold uppercase tracking-wide"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteGroup();
              }}
              disabled={deletingGroup}
              className="rounded-full font-bold uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-group-confirm"
            >
              {deletingGroup ? 'Borrando...' : 'Borrar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkGuestDialog
        open={!!linkGuestTarget}
        onOpenChange={(open) => !open && setLinkGuestTarget(null)}
        groupId={id}
        targetMember={linkGuestTarget}
        guests={guestMembers}
        onMerged={() => loadData({ keepLoader: true })}
      />
    </div>
  );
}
