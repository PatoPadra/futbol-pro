import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Shield, Users, Trophy, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const changeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('Rol actualizado');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) { toast.error('Error al cambiar rol'); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="page-container" data-testid="admin-panel">
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold uppercase tracking-tight">Panel Admin</h1>
            <p className="text-sm text-slate-500">Gestion general del sistema</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label: 'Usuarios', value: stats.total_users, icon: Users },
              { label: 'Perfiles', value: stats.total_profiles, icon: Users },
              { label: 'Invitados', value: stats.guest_players, icon: Users },
              { label: 'Partidos', value: stats.total_matches, icon: Trophy },
              { label: 'Activos', value: stats.active_matches, icon: Trophy },
              { label: 'Completados', value: stats.completed_matches, icon: BarChart3 },
            ].map((s, i) => (
              <Card key={i} className="border-slate-100">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-slate-100 rounded-xl">
            <TabsTrigger value="users" className="rounded-lg font-semibold text-sm">Usuarios ({users.length})</TabsTrigger>
            <TabsTrigger value="matches" className="rounded-lg font-semibold text-sm">Partidos ({matches.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="border-slate-100">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Nombre</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Email</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Rol</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50" data-testid={`admin-user-${u.id}`}>
                          <td className="p-4 font-medium">{u.profile?.name || 'Sin nombre'}</td>
                          <td className="p-4 text-slate-500">{u.email}</td>
                          <td className="p-4">
                            <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className={u.role === 'admin' ? 'bg-slate-800 text-white' : u.role === 'organizador' ? 'bg-turf/10 text-turf border-turf/20' : ''}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Select value={u.role} onValueChange={v => changeRole(u.id, v)}>
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="jugador">Jugador</SelectItem>
                                <SelectItem value="organizador">Organizador</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches">
            <Card className="border-slate-100">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Titulo</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Fecha</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Modalidad</th>
                        <th className="text-left p-4 text-xs uppercase text-slate-500 tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map(m => (
                        <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="p-4 font-medium">{m.title}</td>
                          <td className="p-4 text-slate-500">{m.date}</td>
                          <td className="p-4">F{m.modality}</td>
                          <td className="p-4"><Badge variant="outline" className="text-xs">{m.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
