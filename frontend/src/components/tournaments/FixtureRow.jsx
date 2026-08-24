import React, { useEffect, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';

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
export default function FixtureRow({ fixture, puedeEditar, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Si el fixture cambia por debajo (se recargó el torneo, avanzó una llave),
  // los campos tienen que reflejar el dato nuevo y no el que quedó tipeado.
  useEffect(() => {
    setLocal(fixture.home_score ?? '');
    setVisitante(fixture.away_score ?? '');
  }, [fixture.home_score, fixture.away_score]);

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

  const guardar = async () => {
    if (!valido) return;
    const a = Number(local);
    const b = Number(visitante);

    setGuardando(true);
    try {
      await onGuardar(fixture.id, a, b);
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
      </div>

      {puedeEditar && definido && (
        editando ? (
          <Button
            size="sm"
            shape="pill"
            onClick={guardar}
            disabled={guardando || !valido}
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
