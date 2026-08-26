import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, Save, Send, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import SectionHeading from '@/components/teams/SectionHeading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildPhotoUrl, initialsFromName } from '@/utils/photos';
import { cn } from '@/lib/utils';

/**
 * La planilla de estadísticas del partido.
 *
 * Vive acá y no adentro de PostMatch porque son dos flujos distintos con la
 * misma tabla, y meterlos en la página los mezclaba con las evaluaciones:
 *
 *   Consenso: cada uno propone las estadísticas de cada jugador y después el
 *   resto vota. Funciona con tres números y diez personas.
 *
 *   Planilla del organizador: el organizador carga todo de una y queda firme.
 *   Existe porque la votación no escala — con ocho métricas y dieciséis
 *   jugadores son ciento veintiocho casillas que nadie va a votar, y las
 *   estadísticas terminarían sin confirmarse nunca.
 *
 * Las columnas las dicta el partido (`tracked_stats`), no este componente. Un
 * partido que sigue sólo goles muestra una sola columna.
 */
const CAMPO = 'h-11 bg-slate-50 text-center tabular-nums';
const AVISO = 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900';
const NEUTRO = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600';

/** Un campo vacío es cero. Acá sí: no cargar nada es no haber hecho nada. */
const aEntero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0;
};

const esValido = (valor) =>
  valor === '' || (Number.isInteger(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 99);

function FilaJugador({ player, columnas, valores, onCambio, onAbrirFoto, disabled, badge, children }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors motion-reduce:transition-none',
        badge ? 'border-turf/25 bg-turf/5' : 'border-slate-200 bg-white',
      )}
      data-testid={`stats-player-${player.player_id}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onAbrirFoto?.(player)}
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2"
          aria-label={`Ver foto de ${player.player_name}`}
        >
          <Avatar className="h-11 w-11 shadow-sm ring-2 ring-white">
            <AvatarImage src={buildPhotoUrl(player.player_photo) || undefined} />
            <AvatarFallback className="bg-turf/10 text-xs font-bold text-turf-accessible">
              {initialsFromName(player.player_name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors group-hover:text-turf-accessible">
            <ZoomIn className="h-3 w-3" aria-hidden="true" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {player.player_name}
          </span>
          <span className="text-xs text-slate-600">
            {player.primary_position || 'Sin posición cargada'}
          </span>
        </div>
        {badge}
      </div>

      {/* Dos columnas en el celular pase lo que pase: con ocho métricas, una
          grilla que se adapta al número deja campos de dos centímetros. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {columnas.map((stat) => {
          const valor = valores?.[stat.id] ?? '';
          const invalido = !esValido(valor);
          return (
            <div key={stat.id}>
              <Label
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                htmlFor={`${stat.id}-${player.player_id}`}
              >
                {stat.name}
              </Label>
              <Input
                id={`${stat.id}-${player.player_id}`}
                data-testid={`stat-${stat.id}-${player.player_id}`}
                type="number"
                min="0"
                max="99"
                inputMode="numeric"
                className={CAMPO}
                disabled={disabled}
                value={valor}
                aria-invalid={invalido ? 'true' : undefined}
                onChange={(e) => onCambio(player.player_id, stat.id, e.target.value)}
              />
              {invalido && (
                <p
                  className="mt-1 text-[11px] text-destructive"
                  data-testid={`stat-${stat.id}-error-${player.player_id}`}
                >
                  Un número entero de 0 a 99
                </p>
              )}
            </div>
          );
        })}
      </div>

      {children}
    </div>
  );
}

export default function StatsSheet({
  matchId,
  match,
  players,
  trackableStats,
  existingProposals = [],
  existingFinal = [],
  myRegistration,
  isOrganizer,
  profileId,
  onAbrirFoto,
  onSaved,
}) {
  const porOrganizador = match?.capabilities?.stats_source === 'organizador';
  const [valores, setValores] = useState({});
  const [enviando, setEnviando] = useState('');
  const [propuestos, setPropuestos] = useState(new Set());

  // Las columnas salen del partido y las etiquetas del catálogo. Si el catálogo
  // no cargó, se usa el id como nombre: preferimos una tabla fea a una tabla que
  // no se puede cargar.
  const columnas = useMemo(() => {
    const porId = new Map((trackableStats || []).map((s) => [s.id, s]));
    return (match?.tracked_stats || []).map((id) => porId.get(id) || { id, name: id, short: id });
  }, [match?.tracked_stats, trackableStats]);

  useEffect(() => {
    if (!players.length || !columnas.length) return;

    const base = {};
    players.forEach((player) => {
      base[player.player_id] = {};
      columnas.forEach((stat) => {
        base[player.player_id][stat.id] = 0;
      });
    });

    // En planilla se precarga lo que ya está confirmado; en consenso, la
    // propuesta propia. Son dos cosas distintas: una es el dato oficial y la
    // otra es lo que dije yo.
    const fuente = porOrganizador
      ? existingFinal
      : existingProposals.filter((p) => p.proposed_by === profileId);

    const yaPropuestos = new Set();
    fuente.forEach((fila) => {
      if (!base[fila.player_id]) return;
      const filaValores = fila.values || {};
      columnas.forEach((stat) => {
        base[fila.player_id][stat.id] = filaValores[stat.id] ?? 0;
      });
      yaPropuestos.add(fila.player_id);
    });

    setValores(base);
    setPropuestos(yaPropuestos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, columnas, existingProposals, existingFinal, profileId, porOrganizador]);

  const cambiar = (playerId, statId, valor) => {
    setValores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [statId]: valor },
    }));
  };

  const filaValida = (playerId) =>
    columnas.every((stat) => esValido(valores[playerId]?.[stat.id] ?? ''));

  const todoValido = players.every((p) => filaValida(p.player_id));

  const valoresLimpios = (playerId) => {
    const fila = {};
    columnas.forEach((stat) => {
      const entero = aEntero(valores[playerId]?.[stat.id]);
      if (entero) fila[stat.id] = entero;
    });
    return fila;
  };

  const proponer = async (playerId) => {
    if (!filaValida(playerId)) return;
    setEnviando(`stats-${playerId}`);
    try {
      await api.post(`/matches/${matchId}/stats/propose`, {
        player_id: playerId,
        values: valoresLimpios(playerId),
      });
      toast.success('Estadísticas propuestas');
      setPropuestos((prev) => new Set(prev).add(playerId));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al proponer estadísticas');
    } finally {
      setEnviando('');
    }
  };

  const guardarPlanilla = async () => {
    if (!todoValido) return;
    setEnviando('planilla');
    try {
      const rows = players.map((p) => ({
        player_id: p.player_id,
        values: valoresLimpios(p.player_id),
      }));
      const res = await api.put(`/matches/${matchId}/stats`, { rows });
      toast.success(res.data?.message || 'Estadísticas guardadas');
      await onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar estadísticas');
    } finally {
      setEnviando('');
    }
  };

  if (!columnas.length) {
    return <p className={NEUTRO}>Este partido no sigue ninguna estadística.</p>;
  }

  // En modo planilla el resto no tiene nada que hacer acá. Mostrarles los campos
  // deshabilitados sería ofrecerles una tarea que no es suya.
  if (porOrganizador && !isOrganizer) {
    return (
      <p className={NEUTRO} data-testid="stats-solo-organizador">
        En este partido las estadísticas las carga el organizador. Cuando las
        cargue, las vas a ver en tu historial.
      </p>
    );
  }

  const puedeEditar = porOrganizador ? isOrganizer : Boolean(myRegistration);
  const propuestasHechas = players.filter((p) => propuestos.has(p.player_id)).length;

  return (
    <>
      <SectionHeading
        icono={ClipboardList}
        tono="orange"
        titulo={porOrganizador ? 'Cargar estadísticas' : 'Proponer estadísticas'}
        bajada={
          porOrganizador
            ? 'Lo que cargues queda firme al guardar. Podés volver y corregirlo.'
            : 'Después se validan con los votos del resto de los jugadores.'
        }
        acciones={
          !porOrganizador && players.length > 0 ? (
            <span className="text-xs font-semibold tabular-nums text-slate-600">
              {propuestasHechas}/{players.length} propuestas
            </span>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        {!porOrganizador && !myRegistration && (
          <p className={AVISO}>
            Tenés que estar anotado en este partido para poder proponer estadísticas.
          </p>
        )}

        {players.length === 0 && (
          <p className={NEUTRO}>No hay participantes cargados para este partido todavía.</p>
        )}

        {players.map((player) => (
          <FilaJugador
            key={player.player_id}
            player={player}
            columnas={columnas}
            valores={valores[player.player_id]}
            onCambio={cambiar}
            onAbrirFoto={onAbrirFoto}
            disabled={!puedeEditar}
            badge={
              !porOrganizador && propuestos.has(player.player_id) ? (
                <Badge
                  className="min-h-0 gap-1 border-turf/25 bg-turf/10 font-semibold text-turf-accessible"
                  data-testid={`proposed-badge-${player.player_id}`}
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Propuesto
                </Badge>
              ) : null
            }
          >
            {!porOrganizador && (
              <Button
                variant={propuestos.has(player.player_id) ? 'outline' : 'default'}
                className={cn(
                  'mt-4 min-h-11 w-full rounded-xl text-xs font-bold uppercase tracking-wide',
                  !propuestos.has(player.player_id) && 'bg-turf text-white hover:bg-turf-dark',
                )}
                onClick={() => proponer(player.player_id)}
                disabled={enviando === `stats-${player.player_id}` || !puedeEditar || !filaValida(player.player_id)}
                data-testid={`submit-stats-${player.player_id}`}
              >
                {enviando === `stats-${player.player_id}` ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : propuestos.has(player.player_id) ? (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                {propuestos.has(player.player_id) ? 'Actualizar propuesta' : 'Proponer'}
              </Button>
            )}
          </FilaJugador>
        ))}

        {porOrganizador ? (
          // Barra pegada al pie: con dieciséis jugadores el botón queda a varios
          // scrolls de la última fila.
          <div className="sticky bottom-3 z-10">
            <div className="glass rounded-2xl p-2 shadow-lift">
              <Button
                onClick={guardarPlanilla}
                disabled={enviando === 'planilla' || !puedeEditar || !todoValido || players.length === 0}
                shape="pill"
                className="min-h-12 w-full bg-turf font-bold uppercase tracking-wider text-white hover:bg-turf-dark"
                data-testid="save-stats-sheet-btn"
              >
                {enviando === 'planilla' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar estadísticas
              </Button>
            </div>
          </div>
        ) : (
          <Button
            asChild
            variant="outline"
            className="min-h-11 w-full rounded-xl font-semibold"
            data-testid="go-to-stats-confirmation"
          >
            <Link to={`/partidos/${matchId}/estadisticas`}>
              Ver estado de confirmación
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}
