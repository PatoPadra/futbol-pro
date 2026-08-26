import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, ExternalLink, Loader2, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Una fila del fixture: los dos equipos, el resultado, y la carga del resultado
 * para quien administra el torneo.
 *
 * La edición es en la misma fila y no en un diálogo: cargar los resultados de
 * una fecha son cinco o seis filas seguidas, y abrir y cerrar un modal por cada
 * una convierte dos minutos de tarea en diez.
 *
 * Una llave que todavía no tiene los dos equipos definidos se muestra con "A
 * definir" y sin campos: no hay nada que cargar hasta que se resuelva la ronda
 * anterior, y un input habilitado ahí sólo invita a un error.
 */
export default function FixtureRow({
  fixture,
  puedeEditar,
  onGuardar,
  /** Grupos míos que juegan esta llave y todavía no tienen partido creado. */
  opcionesDePartido,
  onCrearPartido,
}) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [penLocal, setPenLocal] = useState('');
  const [penVisitante, setPenVisitante] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Si el fixture cambia por debajo (se recargó el torneo, avanzó una llave),
  // los campos tienen que reflejar el dato nuevo y no el que quedó tipeado.
  useEffect(() => {
    setLocal(fixture.home_score ?? '');
    setVisitante(fixture.away_score ?? '');
    setPenLocal(fixture.home_penalties ?? '');
    setPenVisitante(fixture.away_penalties ?? '');
  }, [fixture.home_score, fixture.away_score, fixture.home_penalties, fixture.away_penalties]);

  const definido = !!fixture.home_team_id && !!fixture.away_team_id;
  const jugado = fixture.status === 'jugado';

  // Un campo vacío NO es cero. `Number('')` da 0, así que borrar un input y
  // tocar guardar mandaba un 0-0 como si fuera un resultado real. Y con un
  // valor inválido el botón antes no hacía nada y no decía por qué, que desde
  // el celular se siente como que la app se colgó. Ahora el botón se deshabilita
  // y el motivo se ve al lado.
  const valido =
    local !== '' && visitante !== ''
    && Number.isInteger(Number(local)) && Number.isInteger(Number(visitante))
    && Number(local) >= 0 && Number(visitante) >= 0;

  // Los penales sólo aparecen donde hay que definir y sólo si se empató. En una
  // fecha de liga el empate es un resultado válido y no hay nada que desempatar.
  const empatado = valido && Number(local) === Number(visitante);
  const pidePenales = Boolean(fixture.allows_penalties) && empatado;
  const penalesCargados = penLocal !== '' && penVisitante !== '';
  const penalesValidos =
    !pidePenales
    || !penalesCargados
    || (Number.isInteger(Number(penLocal)) && Number.isInteger(Number(penVisitante))
      && Number(penLocal) >= 0 && Number(penVisitante) >= 0
      && Number(penLocal) !== Number(penVisitante));

  const partidos = fixture.matches || [];
  const puedeCrearPartido = Boolean(onCrearPartido && opcionesDePartido?.length);

  const guardar = async () => {
    if (!valido || !penalesValidos) return;
    const a = Number(local);
    const b = Number(visitante);
    // Sólo se mandan si corresponde: en una fecha de liga el backend los
    // rechaza, y con razón.
    const penales = pidePenales && penalesCargados
      ? { home_penalties: Number(penLocal), away_penalties: Number(penVisitante) }
      : { home_penalties: null, away_penalties: null };

    setGuardando(true);
    try {
      await onGuardar(fixture.id, a, b, penales);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  };

  const nombre = (id, nombreDado) => {
    if (nombreDado) return nombreDado;
    return id ? 'Equipo' : 'A definir';
  };

  return (
    <li
      className="flex items-center gap-3 border-t border-slate-100 px-3 py-2.5 first:border-t-0"
      data-testid={`fixture-${fixture.id}`}
    >
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span
          className={cn(
            'truncate text-right text-sm',
            fixture.winner_team_id === fixture.home_team_id
              ? 'font-bold text-slate-900'
              : 'font-medium text-slate-700',
            !fixture.home_team_id && 'italic text-slate-500',
          )}
        >
          {nombre(fixture.home_team_id, fixture.home_team_name)}
        </span>

        {editando ? (
          <span className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`Goles de ${nombre(fixture.home_team_id, fixture.home_team_name)}`}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="h-10 w-12 bg-slate-50 px-1 text-center tabular-nums"
              data-testid={`fixture-home-input-${fixture.id}`}
            />
            <span aria-hidden="true" className="text-slate-400">-</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`Goles de ${nombre(fixture.away_team_id, fixture.away_team_name)}`}
              value={visitante}
              onChange={(e) => setVisitante(e.target.value)}
              className="h-10 w-12 bg-slate-50 px-1 text-center tabular-nums"
              data-testid={`fixture-away-input-${fixture.id}`}
            />
          </span>
        ) : (
          <span
            className={cn(
              'min-w-[3.5rem] rounded-lg px-2 py-1 text-center text-sm font-bold tabular-nums',
              jugado ? 'bg-slate-100 text-slate-900' : 'text-slate-400',
            )}
          >
            {jugado ? `${fixture.home_score} - ${fixture.away_score}` : 'vs'}
            {jugado && fixture.home_penalties != null && (
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {fixture.home_penalties}-{fixture.away_penalties} pen
              </span>
            )}
          </span>
        )}

        <span
          className={cn(
            'truncate text-left text-sm',
            fixture.winner_team_id === fixture.away_team_id
              ? 'font-bold text-slate-900'
              : 'font-medium text-slate-700',
            !fixture.away_team_id && 'italic text-slate-500',
          )}
        >
          {nombre(fixture.away_team_id, fixture.away_team_name)}
        </span>
        {editando && !valido && (
          <span
            className="col-span-3 mt-1 text-center text-xs text-slate-600"
            data-testid={`fixture-hint-${fixture.id}`}
          >
            Cargá los goles de los dos equipos (números enteros, 0 o más).
          </span>
        )}

        {editando && pidePenales && (
          <span
            className="col-span-3 mt-2 flex items-center justify-center gap-2"
            data-testid={`fixture-penalties-${fixture.id}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Penales
            </span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Penales del local"
              value={penLocal}
              onChange={(e) => setPenLocal(e.target.value)}
              className="h-9 w-11 bg-slate-50 px-1 text-center tabular-nums"
              data-testid={`fixture-pen-home-${fixture.id}`}
            />
            <span aria-hidden="true" className="text-slate-400">-</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Penales del visitante"
              value={penVisitante}
              onChange={(e) => setPenVisitante(e.target.value)}
              className="h-9 w-11 bg-slate-50 px-1 text-center tabular-nums"
              data-testid={`fixture-pen-away-${fixture.id}`}
            />
          </span>
        )}

        {editando && pidePenales && !penalesValidos && (
          <span className="col-span-3 mt-1 text-center text-xs text-slate-600">
            Una tanda de penales no termina empatada.
          </span>
        )}

        {editando && pidePenales && !penalesCargados && (
          <span className="col-span-3 mt-1 text-center text-xs text-slate-600">
            Sin penales la llave queda sin definir.
          </span>
        )}

        {/* Los partidos que los grupos crearon para esta llave, y el atajo para
            crear el propio. Van abajo del marcador y no al lado: son de otro
            orden que el resultado. */}
        {(partidos.length > 0 || puedeCrearPartido) && !editando && (
          <span className="col-span-3 mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {partidos.map((partido) => (
              <Link
                key={partido.id}
                to={`/partidos/${partido.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-turf/25 bg-turf/10 px-2 py-0.5 text-[11px] font-semibold text-turf-accessible hover:bg-turf/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-1"
                data-testid={`fixture-match-link-${partido.id}`}
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                {partido.title || 'Ver partido'}
              </Link>
            ))}
            {puedeCrearPartido && (
              <button
                type="button"
                onClick={() => onCrearPartido(fixture, opcionesDePartido)}
                className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-1"
                data-testid={`fixture-create-match-${fixture.id}`}
              >
                <CalendarPlus className="h-3 w-3" aria-hidden="true" />
                Crear mi partido
              </button>
            )}
          </span>
        )}
      </div>

      {puedeEditar && definido && (
        editando ? (
          <Button
            size="sm"
            shape="pill"
            onClick={guardar}
            disabled={guardando || !valido || !penalesValidos}
            aria-label="Guardar resultado"
            title={valido ? undefined : 'Cargá los goles de los dos equipos'}
            data-testid={`fixture-save-${fixture.id}`}
            className="h-10 shrink-0 bg-turf px-3 text-white hover:bg-turf-dark"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            shape="pill"
            onClick={() => setEditando(true)}
            aria-label={jugado ? 'Corregir resultado' : 'Cargar resultado'}
            data-testid={`fixture-edit-${fixture.id}`}
            className="h-10 w-10 shrink-0 p-0 text-slate-500 hover:bg-turf/10 hover:text-turf-accessible"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )
      )}
    </li>
  );
}
