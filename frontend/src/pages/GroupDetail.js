import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Plus,
  Shield,
  Star,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { GROUP_PERMISSION_LABELS, MEMBERSHIP_TYPE_LABELS } from '@/constants/groups';
import GroupDangerZone from '@/components/groups/GroupDangerZone';
import GroupMembersPanel from '@/components/groups/GroupMembersPanel';
import GroupNotFound from '@/components/groups/GroupNotFound';
import HeaderChip from '@/components/groups/HeaderChip';
import InviteMemberPanel from '@/components/groups/InviteMemberPanel';
import LinkGuestDialog from '@/components/groups/LinkGuestDialog';
import SeedRatingsPanel from '@/components/groups/SeedRatingsPanel';
import PageHeader from '@/components/common/PageHeader';
import PageLoader from '@/components/common/PageLoader';
import StatTile from '@/components/common/StatTile';
import { Button } from '@/components/ui/button';
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

  const handleRatingChange = (playerId, value) => {
    setRatingMap((prev) => ({ ...prev, [playerId]: value }));
  };

  if (loading) return <PageLoader />;

  if (!group) return <GroupNotFound onRetry={() => loadData()} />;

  const totalGuests = members.filter((m) => m.membership_type === 'invitado').length;
  const totalOrganizers = members.filter((m) => m.group_permission === 'organizador').length;
  const miRol = GROUP_PERMISSION_LABELS[group.my_group_permission] || group.my_group_permission;

  return (
    <div className="page-container mx-auto max-w-6xl" data-testid="group-detail-page">
      <div className="animate-slide-up space-y-6">
        <PageHeader
          slug="grupo"
          eyebrow="Tu grupo"
          titulo={group.name}
          bajada="Armá el plantel, cargá los puntajes iniciales y salí a jugar."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Users}
          testId="group-header"
          meta={
            <>
              <HeaderChip icono={Users}>{group.members_count} activos</HeaderChip>
              <HeaderChip icono={Star} destacado>
                {miRol}
              </HeaderChip>
              <HeaderChip icono={UserCheck}>
                {MEMBERSHIP_TYPE_LABELS[group.my_membership_type] || group.my_membership_type}
              </HeaderChip>
              {isAdmin && <HeaderChip icono={Shield}>Admin</HeaderChip>}
            </>
          }
          acciones={
            canManage ? (
              <Link to={`/partidos/crear?group_id=${group.id}`} data-testid="group-create-match-link">
                <Button
                  shape="pill"
                  className="h-12 bg-turf px-6 text-white shadow-lg shadow-turf/20 hover:bg-turf-dark"
                  data-testid="group-create-match-btn"
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Crear partido
                </Button>
              </Link>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile icon={Users} value={group.members_count} label="Miembros" />
          <StatTile icon={Shield} value={totalOrganizers} label="Organizan" />
          <StatTile icon={UserPlus} value={totalGuests} label="Invitados" tone="orange" />
          <StatTile icon={Star} value={miRol} label="Tu rol" />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <GroupMembersPanel
              members={members}
              filteredMembers={filteredMembers}
              filterOptions={FILTER_OPTIONS}
              search={search}
              onSearchChange={setSearch}
              filter={filter}
              onFilterChange={setFilter}
              onClearFilters={clearFilters}
              canInvite={canInvite}
              canManage={canManage}
              myProfileId={myProfileId}
              guestCount={guestMembers.length}
              memberActionLoading={memberActionLoading}
              onRemoveMember={requestRemoveMember}
              onLinkGuest={setLinkGuestTarget}
            />

            {canRate && (
              <SeedRatingsPanel
                rateableMembers={rateableMembers}
                ratingMap={ratingMap}
                ratingErrors={ratingErrors}
                onRatingChange={handleRatingChange}
                onSave={handleSaveRatings}
                saving={savingRatings}
                hasRatingErrors={hasRatingErrors}
                myProfileId={myProfileId}
              />
            )}
          </div>

          <div className="space-y-6">
            {canInvite && (
              <InviteMemberPanel
                onSubmit={handleInviteSubmit(onInviteSubmit)}
                register={registerInvite}
                control={inviteControl}
                errors={inviteErrors}
                saving={savingInvite}
                serverError={inviteServerError}
              />
            )}
          </div>
        </div>

        {canManage && <GroupDangerZone groupName={group.name} onDelete={requestDeleteGroup} />}
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
