import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Star, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const ROLE_LABELS = {
  organizador: 'Organizador',
  frecuente: 'Frecuente',
  invitado: 'Invitado',
};

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingRatings, setSavingRatings] = useState(false);
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

  const myProfileId = user?.profile?.id || user?.profile_id;
  const canManage = group && (group.my_member_role === 'organizador' || user?.role === 'admin');
  const canRate = group && (['organizador', 'frecuente', 'admin'].includes(group.my_member_role) || user?.role === 'admin');

  const rateableMembers = useMemo(() => {
    return members.filter(
      (member) => member.player_id !== myProfileId && ['organizador', 'frecuente'].includes(member.member_role)
    );
  }, [members, myProfileId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setSavingInvite(true);
    try {
      await api.post(`/groups/${id}/members`, {
        name: inviteForm.name || null,
        username: inviteForm.username || null,
        email: inviteForm.email || null,
        member_role: inviteForm.member_role,
      });
      toast.success('Jugador agregado al grupo');
      setInviteForm({ name: '', username: '', email: '', member_role: 'frecuente' });
      loadData();
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
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar puntajes');
    } finally {
      setSavingRatings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div>
                      <p className="font-medium">{member.player_name}</p>
                      <p className="text-xs text-slate-500">
                        {member.player_email || 'Sin email'}
                        {member.primary_position ? ` · ${member.primary_position}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Badge variant="outline">{ROLE_LABELS[member.member_role] || member.member_role}</Badge>
                      <Badge variant="outline">{member.player_type || 'jugador'}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {canRate && (
              <Card className="border-slate-100">
                <CardHeader>
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Star className="w-4 h-4" /> Puntaje inicial del grupo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Esto siembra el scoring inicial para los jugadores frecuentes del grupo antes de tener suficientes puntajes por partido.
                  </p>

                  {rateableMembers.length === 0 && (
                    <p className="text-sm text-slate-400">No hay jugadores frecuentes para puntuar todavía.</p>
                  )}

                  <div className="space-y-3">
                    {rateableMembers.map((member) => (
                      <div key={member.player_id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3">
                        <div>
                          <p className="font-medium">{member.player_name}</p>
                          <p className="text-xs text-slate-500">{ROLE_LABELS[member.member_role] || member.member_role}</p>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          step="1"
                          value={ratingMap[member.player_id] || ''}
                          onChange={(e) => setRatingMap((prev) => ({ ...prev, [member.player_id]: e.target.value }))}
                          className="w-24 h-10 bg-slate-50"
                        />
                      </div>
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
            {canManage && (
              <Card className="border-slate-100">
                <CardHeader>
                  <CardTitle className="font-heading text-lg uppercase flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Invitar jugador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="mail@ejemplo.com"
                        className="mt-1.5 h-11 bg-slate-50"
                      />
                    </div>
                    <div>
                      <Label>Nombre de usuario</Label>
                      <Input
                        value={inviteForm.username}
                        onChange={(e) => setInviteForm((prev) => ({ ...prev, username: e.target.value }))}
                        placeholder="Username exacto si ya existe"
                        className="mt-1.5 h-11 bg-slate-50"
                      />
                    </div>
                    <div>
                      <Label>Nombre visible</Label>
                      <Input
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Nombre para mostrar o invitado manual"
                        className="mt-1.5 h-11 bg-slate-50"
                      />
                    </div>
                    <div>
                      <Label>Tipo de miembro</Label>
                      <Select
                        value={inviteForm.member_role}
                        onValueChange={(value) => setInviteForm((prev) => ({ ...prev, member_role: value }))}
                      >
                        <SelectTrigger className="mt-1.5 h-11 bg-slate-50">
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
                      className="w-full bg-turf hover:bg-turf-dark text-white rounded-full font-bold uppercase"
                    >
                      {savingInvite ? 'Agregando...' : 'Agregar al grupo'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-100">
              <CardContent className="p-5">
                <p className="text-sm text-slate-500">
                  Los partidos de este grupo solo admiten inscripciones de miembros activos del grupo.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
