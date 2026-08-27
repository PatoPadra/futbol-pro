import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Shield, Users, Trophy, BarChart3, UserCheck, UserCog, Loader2, RefreshCw, Calendar, AlertTriangle, ChevronRight, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { MATCH_STATUS_ACCENT_BORDER, MODALITY_LABELS } from '@/constants/matches';
import PageLoader from '@/components/common/PageLoader';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import PanelSection from '@/components/panels/PanelSection';
import CounterTiles from '@/components/panels/CounterTiles';
import PanelSearch from '@/components/panels/PanelSearch';
import { EstadoChip, RolChip } from '@/components/panels/StatusChip';
import { buildPhotoUrl } from '@/utils/photos';

const ROLE_LABELS = {
  jugador: 'Jugador',
  organizador: 'Organizador',
  admin: 'Admin',
};

const initialsOf = (name, email) => {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.substring(0, 2).toUpperCase();
};

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [pendingChange, setPendingChange] = useState(null); // { user, newRole }
  const [submittingChange, setSubmittingChange] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [sRes, uRes, mRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/matches'),
      ]);
      setStats(sRes.data);
      setUsers(uRes.data || []);
      setMatches(mRes.data || []);
    } catch (err) {
      toast.error('Error al cargar datos de admin');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestRoleChange = (targetUser, newRole) => {
    if (newRole === targetUser.role) return;
    setPendingChange({ user: targetUser, newRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;
    const { user: targetUser, newRole } = pendingChange;
    setSubmittingChange(true);
    try {
      await api.put(`/admin/users/${targetUser.id}/role`, { role: newRole });
      toast.success(`Rol de ${targetUser.profile?.name || targetUser.email} actualizado a ${ROLE_LABELS[newRole]}`);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
      setPendingChange(null);
    } catch (err) {
      toast.error('No se pudo cambiar el rol. Intentá de nuevo.');
    } finally {
      setSubmittingChange(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) => (u.profile?.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  const filteredMatches = useMemo(() => {
    const term = matchSearch.trim().toLowerCase();
    if (!term) return matches;
    return matches.filter((m) => (m.title || '').toLowerCase().includes(term));
  }, [matches, matchSearch]);

  if (loading) {
    return <PageLoader />;
  }

  if (error && !stats && users.length === 0 && matches.length === 0) {
    return (
      <div className="page-container" data-testid="admin-panel">
        <PageHeader
          slug="admin"
          eyebrow="Sistema"
          titulo="Panel Admin"
          bajada="Gestión general del sistema."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Shield}
        />

        <EmptyState
          variante={0}
          icono={Shield}
          titulo="No pudimos cargar el panel"
          descripcion="Se cayó alguna de las tres consultas de administración. Probá de nuevo; si sigue igual, revisá el estado del servidor."
          className="mt-6"
          accion={
            <Button onClick={load} variant="outline" shape="pill" className="border-2 border-white/70 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white" data-testid="admin-retry">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  const statCards = stats
    ? [
        { key: 'total_users', label: 'Usuarios', value: stats.total_users, icon: Users, tone: 'slate' },
        { key: 'total_profiles', label: 'Perfiles', value: stats.total_profiles, icon: UserCheck, tone: 'slate' },
        { key: 'guest_players', label: 'Invitados', value: stats.guest_players, icon: UserCog, tone: 'orange' },
        { key: 'total_matches', label: 'Partidos', value: stats.total_matches, icon: Trophy, tone: 'slate' },
        { key: 'active_matches', label: 'Activos', value: stats.active_matches, icon: Trophy, tone: 'turf' },
        { key: 'completed_matches', label: 'Completados', value: stats.completed_matches, icon: BarChart3, tone: 'slate' },
      ]
    : [];

  const isHighImpact = pendingChange && (pendingChange.newRole === 'admin' || pendingChange.user?.role === 'admin');

  const tabTriggerClass =
    'h-10 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm';

  return (
    <div className="page-container" data-testid="admin-panel">
      <div className="animate-slide-up motion-reduce:animate-none">
        <PageHeader
          slug="admin"
          eyebrow="Sistema"
          titulo="Panel Admin"
          bajada="Gestión general del sistema: usuarios, roles y partidos."
          volverA="/dashboard"
          volverLabel="Inicio"
          icono={Shield}
        />

        {/* Stats */}
        {statCards.length > 0 && (
          <CounterTiles
            className="mt-6"
            items={statCards.map((s) => ({ ...s, testId: `admin-stat-${s.key}` }))}
          />
        )}

        <Tabs defaultValue="users" className="mt-6 space-y-5">
          <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
            <TabsTrigger value="users" className={tabTriggerClass} data-testid="admin-tab-users">
              <Users className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Usuarios ({users.length})
            </TabsTrigger>
            <TabsTrigger value="matches" className={tabTriggerClass} data-testid="admin-tab-matches">
              <Trophy className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Partidos ({matches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <PanelSection
              icono={Users}
              tono="charcoal"
              titulo="Usuarios"
              contador={`${filteredUsers.length} de ${users.length}`}
              descripcion="El rol define a qué llega cada cuenta. Los cambios aplican de inmediato."
              sinPadding
            >
              <div className="border-b border-slate-100 p-4 md:p-5">
                <PanelSearch
                  id="admin-user-search-input"
                  label="Buscar usuario por nombre o email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onLimpiar={() => setUserSearch('')}
                  placeholder="Buscar por nombre o email..."
                  resultados={filteredUsers.length}
                  sustantivo="usuarios"
                  testId="admin-user-search"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-4 md:p-5" data-testid="admin-users-empty">
                  <EmptyState
                    variante={1}
                    icono={Users}
                    titulo={userSearch ? 'Sin resultados' : 'Todavía no hay usuarios'}
                    descripcion={
                      userSearch
                        ? 'No encontramos usuarios con esa búsqueda. Probá con parte del nombre o del email.'
                        : 'Todavía no hay usuarios registrados en el sistema.'
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Encabezado de columnas: solo desde md, donde la fila entra completa. */}
                  <div className="hidden border-b border-slate-100 bg-white px-5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 md:flex md:items-center md:gap-3">
                    <span className="flex-1">Cuenta</span>
                    <span className="w-28">Rol actual</span>
                    <span className="w-36 text-right">Cambiar rol</span>
                  </div>

                  <ul className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const isSelf = currentUser?.user_id === u.id;
                      const isChangingThis = submittingChange && pendingChange?.user?.id === u.id;
                      return (
                        <li
                          key={u.id}
                          data-testid={`admin-user-${u.id}`}
                          className="flex flex-col gap-3 px-4 py-3 transition-colors even:bg-slate-50/60 hover:bg-turf/5 md:flex-row md:items-center md:px-5"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Avatar className="h-10 w-10 shrink-0 ring-1 ring-slate-200">
                              <AvatarImage src={buildPhotoUrl(u.profile?.photo_url) || undefined} />
                              <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">
                                {initialsOf(u.profile?.name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900">
                                {u.profile?.name || 'Sin nombre'}
                                {isSelf && (
                                  <span className="shrink-0 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                    Vos
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs tabular-nums text-slate-600">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
                            <div className="md:w-28">
                              <RolChip role={u.role} />
                            </div>

                            {isSelf ? (
                              <span
                                className="flex w-36 items-center justify-end gap-1.5 text-right text-[11px] leading-tight text-slate-600"
                                data-testid={`admin-role-self-${u.id}`}
                              >
                                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                                No podés cambiar tu propio rol
                              </span>
                            ) : (
                              <Select
                                value={u.role}
                                onValueChange={(v) => requestRoleChange(u, v)}
                                disabled={isChangingThis}
                              >
                                <SelectTrigger
                                  className="h-11 w-36 rounded-lg border-slate-200 bg-white text-xs"
                                  data-testid={`admin-role-select-${u.id}`}
                                >
                                  {isChangingThis ? (
                                    <span className="flex items-center gap-1.5 text-slate-600">
                                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Guardando...
                                    </span>
                                  ) : (
                                    <SelectValue />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="jugador">Jugador</SelectItem>
                                  <SelectItem value="organizador">Organizador</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </PanelSection>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <PanelSection
              icono={Trophy}
              tono="turf"
              titulo="Partidos"
              contador={`${filteredMatches.length} de ${matches.length}`}
              descripcion="Todos los partidos del sistema. Entrá a uno para ver el detalle."
              sinPadding
            >
              <div className="border-b border-slate-100 p-4 md:p-5">
                <PanelSearch
                  id="admin-match-search-input"
                  label="Buscar partido por título"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  onLimpiar={() => setMatchSearch('')}
                  placeholder="Buscar por título..."
                  resultados={filteredMatches.length}
                  sustantivo="partidos"
                  testId="admin-match-search"
                />
              </div>

              {filteredMatches.length === 0 ? (
                <div className="p-4 md:p-5" data-testid="admin-matches-empty">
                  <EmptyState
                    variante={2}
                    icono={Trophy}
                    titulo={matchSearch ? 'Sin resultados' : 'Todavía no hay partidos'}
                    descripcion={
                      matchSearch
                        ? 'No encontramos partidos con esa búsqueda. Probá con parte del título.'
                        : 'Todavía no hay partidos creados en el sistema.'
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredMatches.map((m) => (
                    <li key={m.id} className="even:bg-slate-50/60">
                      <Link
                        to={`/partidos/${m.id}`}
                        className={`flex min-h-[56px] items-center gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-turf/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-turf md:px-5 ${MATCH_STATUS_ACCENT_BORDER[m.status] || 'border-l-slate-200'}`}
                        data-testid={`admin-match-${m.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{m.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3 w-3" aria-hidden="true" /> {m.date}
                            </span>
                            <span>{MODALITY_LABELS[m.modality] || `Futbol ${m.modality}`}</span>
                          </div>
                        </div>

                        <EstadoChip status={m.status} className="shrink-0" />
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={!!pendingChange}
        onOpenChange={(open) => !open && !submittingChange && setPendingChange(null)}
      >
        <AlertDialogContent className="rounded-2xl" data-testid="admin-role-confirm-dialog">
          <AlertDialogHeader>
            {isHighImpact && (
              <div className="mb-1 flex items-center gap-2 rounded-xl border border-orange/25 bg-orange/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-orange-accessible">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Cambio sensible de permisos
              </div>
            )}
            <AlertDialogTitle className="text-left font-heading text-xl uppercase tracking-tight">
              ¿Cambiar el rol de {pendingChange?.user?.profile?.name || pendingChange?.user?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-relaxed">
              {pendingChange?.newRole === 'admin'
                ? 'Va a tener acceso total al sistema: gestión de usuarios, roles y estadísticas. Este cambio aplica de inmediato.'
                : pendingChange?.user?.role === 'admin'
                ? 'Va a perder el acceso de administrador, incluyendo la gestión de usuarios y roles. Este cambio aplica de inmediato.'
                : `Va a pasar de ${ROLE_LABELS[pendingChange?.user?.role]} a ${ROLE_LABELS[pendingChange?.newRole]}. Este cambio aplica de inmediato.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingChange && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <RolChip role={pendingChange.user?.role} />
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <RolChip role={pendingChange.newRole} />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="admin-role-cancel"
              disabled={submittingChange}
              className="h-11 rounded-full font-bold uppercase tracking-wide"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRoleChange();
              }}
              disabled={submittingChange}
              className={`h-11 rounded-full font-bold uppercase tracking-wide ${
                isHighImpact
                  ? 'bg-orange-accessible text-white hover:bg-orange-accessible/90'
                  : 'bg-turf-btn text-white hover:bg-turf-btn-dark'
              }`}
              data-testid="admin-role-confirm"
            >
              {submittingChange ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Guardando...
                </>
              ) : (
                'Confirmar cambio'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
