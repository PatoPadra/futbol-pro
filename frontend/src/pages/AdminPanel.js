import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
import { Shield, Users, Trophy, BarChart3, UserCheck, UserCog, Search, Loader2, RefreshCw, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { MATCH_STATUS_BADGE_CLASS, MATCH_STATUS_LABELS, MODALITY_LABELS } from '@/constants/matches';
import PageLoader from '@/components/common/PageLoader';

const ROLE_LABELS = {
  jugador: 'Jugador',
  organizador: 'Organizador',
  admin: 'Admin',
};

const ROLE_BADGE_CLASS = {
  admin: 'bg-slate-900 text-white border-transparent',
  organizador: 'bg-turf/10 text-turf-accessible border-turf/20',
  jugador: 'bg-slate-100 text-slate-700 border-slate-200',
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
        <Card className="border-dashed border-slate-200 mt-8">
          <CardContent className="p-10 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium mb-4">No pudimos cargar el panel de administración</p>
            <Button onClick={load} variant="outline" className="rounded-full" data-testid="admin-retry">
              <RefreshCw className="w-4 h-4 mr-1.5" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = stats
    ? [
        { key: 'total_users', label: 'Usuarios', value: stats.total_users, icon: Users, tone: 'slate' },
        { key: 'total_profiles', label: 'Perfiles', value: stats.total_profiles, icon: UserCheck, tone: 'slate' },
        { key: 'guest_players', label: 'Invitados', value: stats.guest_players, icon: UserCog, tone: 'orange' },
        { key: 'total_matches', label: 'Partidos', value: stats.total_matches, icon: Trophy, tone: 'slate' },
        { key: 'active_matches', label: 'Activos', value: stats.active_matches, icon: Trophy, tone: 'orange' },
        { key: 'completed_matches', label: 'Completados', value: stats.completed_matches, icon: BarChart3, tone: 'turf' },
      ]
    : [];

  const toneClasses = {
    slate: 'bg-slate-100 text-slate-600',
    orange: 'bg-orange/10 text-orange',
    turf: 'bg-turf/10 text-turf-accessible',
  };

  const isHighImpact = pendingChange && (pendingChange.newRole === 'admin' || pendingChange.user?.role === 'admin');

  return (
    <div className="page-container" data-testid="admin-panel">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Panel Admin</h1>
            <p className="text-sm text-slate-500">Gestión general del sistema</p>
          </div>
        </div>

        {/* Stats */}
        {statCards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {statCards.map((s) => (
              <Card key={s.key} className="border-slate-100" data-testid={`admin-stat-${s.key}`}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${toneClasses[s.tone]}`}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{s.value ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 rounded-xl">
            <TabsTrigger value="users" className="rounded-lg font-semibold text-sm" data-testid="admin-tab-users">
              Usuarios ({users.length})
            </TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg font-semibold text-sm" data-testid="admin-tab-matches">
              Partidos ({matches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="h-12 bg-slate-50 border-slate-200 focus:border-turf focus:ring-2 focus:ring-turf/20 rounded-lg pl-10"
                data-testid="admin-user-search"
              />
            </div>

            {filteredUsers.length === 0 ? (
              <Card className="border-dashed border-slate-200" data-testid="admin-users-empty">
                <CardContent className="p-8 text-center">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {userSearch ? 'No encontramos usuarios con esa búsqueda' : 'Todavía no hay usuarios registrados'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.user_id === u.id;
                  const isChangingThis = submittingChange && pendingChange?.user?.id === u.id;
                  return (
                    <Card key={u.id} className="border-slate-100" data-testid={`admin-user-${u.id}`}>
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                              {initialsOf(u.profile?.name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {u.profile?.name || 'Sin nombre'}
                              {isSelf && <span className="text-xs text-slate-400 font-normal"> (vos)</span>}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
                          <Badge className={`text-xs border ${ROLE_BADGE_CLASS[u.role] || ROLE_BADGE_CLASS.jugador}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>

                          {isSelf ? (
                            <span
                              className="text-xs text-slate-400 italic px-1 max-w-[9rem] text-right"
                              data-testid={`admin-role-self-${u.id}`}
                            >
                              No podés cambiar tu propio rol
                            </span>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(v) => requestRoleChange(u, v)}
                              disabled={isChangingThis}
                            >
                              <SelectTrigger className="h-9 w-36 text-xs" data-testid={`admin-role-select-${u.id}`}>
                                {isChangingThis ? (
                                  <span className="flex items-center gap-1.5 text-slate-400">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                placeholder="Buscar por título..."
                className="h-12 bg-slate-50 border-slate-200 focus:border-turf focus:ring-2 focus:ring-turf/20 rounded-lg pl-10"
                data-testid="admin-match-search"
              />
            </div>

            {filteredMatches.length === 0 ? (
              <Card className="border-dashed border-slate-200" data-testid="admin-matches-empty">
                <CardContent className="p-8 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {matchSearch ? 'No encontramos partidos con esa búsqueda' : 'Todavía no hay partidos creados'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredMatches.map((m) => (
                  <Link
                    to={`/partidos/${m.id}`}
                    key={m.id}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
                    data-testid={`admin-match-${m.id}`}
                  >
                    <Card className="border-slate-100 hover:shadow-sm cursor-pointer transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{m.title}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {m.date}
                            </span>
                            <span>{MODALITY_LABELS[m.modality] || `Futbol ${m.modality}`}</span>
                          </div>
                        </div>
                        <Badge
                          className={`text-xs font-semibold border shrink-0 ${MATCH_STATUS_BADGE_CLASS[m.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          {MATCH_STATUS_LABELS[m.status] || m.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={!!pendingChange}
        onOpenChange={(open) => !open && !submittingChange && setPendingChange(null)}
      >
        <AlertDialogContent className="rounded-2xl" data-testid="admin-role-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isHighImpact && <AlertTriangle className="w-5 h-5 text-orange shrink-0" />}
              ¿Cambiar el rol de {pendingChange?.user?.profile?.name || pendingChange?.user?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.newRole === 'admin'
                ? 'Va a tener acceso total al sistema: gestión de usuarios, roles y estadísticas. Este cambio aplica de inmediato.'
                : pendingChange?.user?.role === 'admin'
                ? 'Va a perder el acceso de administrador, incluyendo la gestión de usuarios y roles. Este cambio aplica de inmediato.'
                : `Va a pasar de ${ROLE_LABELS[pendingChange?.user?.role]} a ${ROLE_LABELS[pendingChange?.newRole]}. Este cambio aplica de inmediato.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="admin-role-cancel"
              disabled={submittingChange}
              className="rounded-full font-bold uppercase tracking-wide"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRoleChange();
              }}
              disabled={submittingChange}
              className="rounded-full font-bold uppercase tracking-wide"
              data-testid="admin-role-confirm"
            >
              {submittingChange ? 'Guardando...' : 'Confirmar cambio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
