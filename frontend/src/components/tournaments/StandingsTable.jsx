import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tabla de posiciones.
 *
 * En mobile las columnas no entran todas, y esconderlas detrás de un scroll
 * horizontal invisible es la forma clásica de que nadie encuentre los goles a
 * favor. Así que la tabla scrollea DENTRO de su caja (con el borde visible como
 * pista) y las tres columnas que se leen de un vistazo — puesto, equipo y
 * puntos — quedan FIJAS con `sticky`: PJ y las demás son el detalle.
 *
 * Esto último el comentario lo prometía desde el principio y el código no lo
 * hacía: era `overflow-x-auto` a secas. En 360px, scrollear para ver los goles
 * a favor te dejaba sin saber de qué equipo era la fila, y los puntos —que son
 * la columna por la que existe una tabla de posiciones— quedaban fuera de
 * pantalla desde el arranque.
 *
 * Las celdas fijas necesitan fondo opaco propio (si no, el contenido que
 * scrollea se les ve por debajo) y una sombra lateral que señale el corte. Y el
 * ancho de la columna del puesto va FIJADO (`w-10`): el `left` de la columna
 * que va pegada a su derecha depende de él, así que con el ancho libre una
 * tabla de más de nueve equipos empujaba el nombre por debajo del número.
 *
 * Cuando el torneo tiene zonas se pinta una tabla por zona; agrupar es tarea de
 * quien la usa, acá se recibe la lista ya filtrada.
 */
const COLUMNAS = [
  { key: 'played', corto: 'PJ', label: 'Partidos jugados' },
  { key: 'won', corto: 'PG', label: 'Partidos ganados' },
  { key: 'drawn', corto: 'PE', label: 'Partidos empatados' },
  { key: 'lost', corto: 'PP', label: 'Partidos perdidos' },
  { key: 'goals_for', corto: 'GF', label: 'Goles a favor' },
  { key: 'goals_against', corto: 'GC', label: 'Goles en contra' },
  { key: 'goal_diff', corto: 'DG', label: 'Diferencia de gol' },
];

export default function StandingsTable({
  filas = [],
  /** Cuántos de esta tabla clasifican. Marca la línea de corte. */
  clasifican = 0,
  className,
  testId = 'standings-table',
}) {
  if (!filas.length) return null;

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-slate-200', className)}>
      <table className="w-full min-w-[520px] text-sm" data-testid={testId}>
        <caption className="sr-only">
          Tabla de posiciones: puesto, equipo, partidos, goles y puntos
        </caption>
        <thead>
          <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            <th scope="col" className="sticky left-0 z-20 w-10 bg-slate-50 py-2 pl-3 pr-1 text-left font-bold">#</th>
            <th scope="col" className="sticky left-10 z-20 bg-slate-50 py-2 pr-2 text-left font-bold shadow-[1px_0_0_0_theme(colors.slate.200)]">
              Equipo
            </th>
            {COLUMNAS.map((c) => (
              <th key={c.key} scope="col" className="px-2 py-2 text-right font-bold" title={c.label}>
                <span aria-hidden="true">{c.corto}</span>
                <span className="sr-only">{c.label}</span>
              </th>
            ))}
            <th scope="col" className="sticky right-0 z-20 bg-slate-50 py-2 pl-2 pr-3 text-right font-bold shadow-[-1px_0_0_0_theme(colors.slate.200)]">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => {
            // La línea de corte se dibuja abajo del último que clasifica. Es la
            // información que la gente busca primero en una tabla de zona.
            const ultimoQueClasifica = clasifican > 0 && i === clasifican - 1 && i < filas.length - 1;
            return (
              <tr
                key={fila.team_id}
                data-testid={`standings-row-${fila.team_id}`}
                className={cn(
                  'border-t border-slate-100',
                  ultimoQueClasifica && 'border-b-2 border-b-turf',
                )}
              >
                <td className="sticky left-0 z-10 w-10 bg-white py-2 pl-3 pr-1 text-left font-bold tabular-nums text-slate-600">
                  {i + 1}
                </td>
                <th
                  scope="row"
                  className="sticky left-10 z-10 bg-white py-2 pr-2 text-left font-semibold text-slate-900 shadow-[1px_0_0_0_theme(colors.slate.200)]"
                >
                  <span className="block max-w-[8rem] truncate sm:max-w-[10rem]">{fila.name}</span>
                </th>
                {COLUMNAS.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {c.key === 'goal_diff' && fila[c.key] > 0 ? `+${fila[c.key]}` : fila[c.key]}
                  </td>
                ))}
                <td className="sticky right-0 z-10 bg-white py-2 pl-2 pr-3 text-right font-bold tabular-nums text-slate-900 shadow-[-1px_0_0_0_theme(colors.slate.200)]">
                  {fila.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
