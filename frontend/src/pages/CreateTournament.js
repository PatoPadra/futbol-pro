import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Loader2, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';

import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import PageHeader from '@/components/common/PageHeader';
import SectionPanel from '@/components/groups/SectionPanel';
import { FORMATOS } from '@/constants/torneos';
import { cn } from '@/lib/utils';

const MIN_EQUIPOS = 2;

/**
 * Alta de un torneo.
 *
 * Sólo se pueden sumar grupos que la persona ORGANIZA: el backend lo exige y
 * acá directamente no se muestran los otros, así nadie elige algo que después
 * le va a rebotar. Si alguien no organiza ningún grupo, la pantalla lo dice y
 * ofrece crear uno en vez de mostrar una lista vacía sin explicación.
 *
 * Las opciones de zonas y de cuántos clasifican aparecen SÓLO en el formato que
 * las usa: en una liga son ruido, y un campo que no hace nada enseña mal.
 */
export default function CreateTournament() {
  const navigate = useNavigate();

  const [grupos, setGrupos] = useState([]);
  const [cargandoGrupos, setCargandoGrupos] = useState(true);
  const [nombre, setNombre] = useState('');
  const [formato, setFormato] = useState('liga');
  const [elegidos, setElegidos] = useState([]);
  const [zonas, setZonas] = useState(2);
  const [clasifican, setClasifican] = useState(2);
  const [guardando, setGuardando] = useState(false);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then((res) => {
        const míos = (res.data || []).filter(
          (g) => g.my_member_role === 'organizador' || g.my_member_role === 'admin',
        );
        setGrupos(míos);
      })
      .catch((err) => toast.error(err.response?.data?.detail || 'No pudimos cargar tus grupos'))
      .finally(() => setCargandoGrupos(false));
  }, []);

  const toggleGrupo = (id) => {
    setElegidos((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const formatoElegido = useMemo(() => FORMATOS.find((f) => f.id === formato), [formato]);

  const errorNombre = tocado && nombre.trim().length < 3
    ? 'El nombre tiene que tener al menos 3 caracteres'
    : null;
  const errorEquipos = tocado && elegidos.length < MIN_EQUIPOS
    ? `Elegí al menos ${MIN_EQUIPOS} grupos para que haya torneo`
    : null;

  // Cuántos partidos van a salir. Se calcula en vivo porque es el dato que más
  // sorprende: una liga de 6 equipos son 15 partidos y conviene saberlo ANTES.
  const partidosEstimados = formatoElegido?.partidos
    ? formatoElegido.partidos(elegidos.length)
    : null;

  const zonasPosibles = Math.max(1, Math.min(8, Math.floor(elegidos.length / 2) || 1));

  // Lo que se MUESTRA es lo que se va a mandar. Antes el input arrancaba en 2 y
  // el máximo dependía de cuántos equipos había elegidos (que arranca en cero),
  // así que se veía un "2" contra un `max=1` y contra un texto que decía "entran
  // hasta 1". El submit lo clampaba igual, pero la pantalla mentía sobre lo que
  // iba a quedar guardado.
  const zonasEfectivas = Math.min(zonas, zonasPosibles);

  const crear = async () => {
    setTocado(true);
    if (nombre.trim().length < 3 || elegidos.length < MIN_EQUIPOS) return;

    setGuardando(true);
    try {
      const res = await api.post('/tournaments', {
        name: nombre.trim(),
        format: formato,
        group_ids: elegidos,
        zones_count: zonasEfectivas,
        qualifiers_per_zone: clasifican,
      });

      const rechazados = res.data?.rejected_groups || [];
      if (rechazados.length) {
        toast.warning(`El torneo se creó, pero ${rechazados.length} grupo(s) no se pudieron sumar.`);
      } else {
        toast.success('¡Torneo creado!');
      }
      navigate(`/torneos/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos crear el torneo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="page-container mx-auto max-w-2xl" data-testid="create-tournament-page">
      <PageHeader
        slug="crear-torneo"
        priority
        icono={Trophy}
        eyebrow="Nuevo torneo"
        titulo="Crear torneo"
        bajada="Elegí qué grupos compiten y con qué formato. Cada grupo entra como un equipo."
        volverA="/torneos"
        volverLabel="Torneos"
        testId="create-tournament-header"
      />

      <div className="mt-6 space-y-5">
        <SectionPanel icono={Trophy} titulo="¿Cómo se llama?">
          <Label htmlFor="tournament-name">
            Nombre del torneo <span className="text-orange-accessible">*</span>
          </Label>
          <Input
            id="tournament-name"
            data-testid="tournament-name-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Copa de los jueves"
            className="mt-1.5 h-12 rounded-xl bg-slate-50"
            autoFocus
          />
          {errorNombre && (
            <p className="mt-1 text-xs text-red-600" data-testid="tournament-name-error">{errorNombre}</p>
          )}
        </SectionPanel>

        <SectionPanel icono={Users} titulo="Qué grupos juegan">
          {cargandoGrupos ? (
            <div className="flex items-center gap-2 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando tus grupos…
            </div>
          ) : grupos.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-center" data-testid="no-groups-warning">
              <p className="text-sm text-slate-700">
                Todavía no organizás ningún grupo. Sólo podés sumar a un torneo los grupos que
                organizás vos.
              </p>
              <Button
                variant="outline"
                shape="pill"
                onClick={() => navigate('/grupos/crear')}
                className="mt-3 h-11 bg-white px-5"
              >
                Crear un grupo
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-slate-600">
                Sólo aparecen los grupos que organizás. Elegí al menos {MIN_EQUIPOS}.
              </p>
              <ul className="mt-3 space-y-2" role="group" aria-label="Grupos del torneo">
                {grupos.map((g) => {
                  const activo = elegidos.includes(g.id);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        data-testid={`tournament-group-${g.id}`}
                        aria-pressed={activo}
                        onClick={() => toggleGrupo(g.id)}
                        className={cn(
                          'flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 motion-reduce:transition-none',
                          activo
                            ? 'border-turf bg-turf/10'
                            : 'border-slate-200 bg-white hover:border-turf/60 hover:bg-turf/5',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                            activo ? 'bg-turf-btn text-white' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {activo ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-900">{g.name}</span>
                          <span className="block text-xs text-slate-600">
                            {g.members_count} {g.members_count === 1 ? 'miembro' : 'miembros'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {errorEquipos && (
                <p className="mt-2 text-xs text-red-600" data-testid="tournament-groups-error">{errorEquipos}</p>
              )}
            </>
          )}
        </SectionPanel>

        <SectionPanel icono={Trophy} titulo="Formato">
          <div className="space-y-2" role="radiogroup" aria-label="Formato del torneo">
            {FORMATOS.map((f) => {
              const activo = formato === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  data-testid={`tournament-format-${f.id}`}
                  onClick={() => setFormato(f.id)}
                  className={cn(
                    'block w-full rounded-2xl border p-3.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 motion-reduce:transition-none',
                    activo
                      ? 'border-turf bg-turf/10'
                      : 'border-slate-200 bg-white hover:border-turf/60 hover:bg-turf/5',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                        activo ? 'border-turf bg-turf' : 'border-slate-300',
                      )}
                    >
                      {activo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
                      {f.label}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-slate-600">
                    {f.detalle}
                  </span>
                </button>
              );
            })}
          </div>

          {formato === 'zonas_eliminatoria' && (
            <div className="mt-4 grid grid-cols-2 gap-3" data-testid="zones-config">
              <div>
                <Label htmlFor="zones-count">Cuántas zonas</Label>
                <Input
                  id="zones-count"
                  type="number"
                  min={1}
                  max={zonasPosibles}
                  value={zonasEfectivas}
                  onChange={(e) => setZonas(Number(e.target.value) || 1)}
                  className="mt-1.5 h-12 rounded-xl bg-slate-50"
                  data-testid="zones-count-input"
                />
                <p className="mt-1 text-xs text-slate-600">
                  Con {elegidos.length} equipos entran hasta {zonasPosibles}.
                </p>
              </div>
              <div>
                <Label htmlFor="qualifiers-count">Clasifican por zona</Label>
                <Input
                  id="qualifiers-count"
                  type="number"
                  min={1}
                  max={8}
                  value={clasifican}
                  onChange={(e) => setClasifican(Number(e.target.value) || 1)}
                  className="mt-1.5 h-12 rounded-xl bg-slate-50"
                  data-testid="qualifiers-count-input"
                />
                <p className="mt-1 text-xs text-slate-600">Los que pasan a las llaves.</p>
              </div>
            </div>
          )}

          {partidosEstimados > 0 && (
            <div
              className="mt-4 flex items-start gap-2 rounded-2xl border border-turf/25 bg-turf/5 px-3.5 py-3 text-sm text-slate-700"
              data-testid="matches-estimate"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-turf-accessible" aria-hidden="true" />
              <p>
                Con {elegidos.length} equipos van a salir <strong>{partidosEstimados} partidos</strong>.
              </p>
            </div>
          )}
        </SectionPanel>

        <Button
          onClick={crear}
          disabled={guardando || cargandoGrupos}
          shape="pill"
          data-testid="create-tournament-submit"
          className="h-12 w-full bg-turf-btn text-white shadow-lg shadow-turf/20 hover:bg-turf-btn-dark disabled:active:scale-100"
        >
          {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
          {guardando ? 'Creando…' : 'Crear torneo'}
        </Button>

        <p className="pb-2 text-center text-xs leading-relaxed text-slate-600">
          El fixture se arma después, cuando estés seguro de qué equipos entran. Hasta ese momento
          podés seguir sumando o sacando grupos.
        </p>
      </div>
    </div>
  );
}
