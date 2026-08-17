import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Hand, Shirt, Target, Users } from 'lucide-react';

import RatingBadge from '@/components/common/RatingBadge';
import { cn } from '@/lib/utils';

/**
 * Historial de partidos como línea de tiempo.
 *
 * Antes era una lista plana de filas iguales: para saber cuándo fue cada partido
 * había que leer una fecha chiquita en gris. Acá los partidos se agrupan por mes
 * y el marcador de cada fila es el día, así el "cuándo" se ve antes de leer.
 *
 * Presentación pura: recibe el historial en el orden que ya venía del backend
 * (del más nuevo al más viejo), no reordena ni filtra nada, y respeta el permiso
 * de puntajes que decide la página.
 */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Igual criterio que en la página: se parsea a mano para que una fecha sin hora
// ("2026-01-15") no se corra un día en zonas horarias negativas como la nuestra.
function partesDeFecha(dateStr) {
  if (!dateStr) return null;
  const soloFecha = String(dateStr).split('T')[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(soloFecha);
  return m ? { anio: m[1], mes: m[2], dia: m[3] } : null;
}

function etiquetaDeMes(dateStr) {
  const p = partesDeFecha(dateStr);
  if (!p) return 'Sin fecha';
  const nombre = MESES[Number(p.mes) - 1] || '';
  const texto = nombre ? `${nombre} de ${p.anio}` : p.anio;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function agrupar(history) {
  const grupos = [];
  history.forEach((h) => {
    const etiqueta = etiquetaDeMes(h.match_date);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.items.push(h);
    else grupos.push({ etiqueta, items: [h] });
  });
  return grupos;
}

export default function MatchTimeline({ history, posMap, canViewPeerScores }) {
  const grupos = agrupar(history);

  return (
    <div className="space-y-6">
      {grupos.map((grupo, gi) => (
        <section key={`${grupo.etiqueta}-${gi}`}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-slate-600">
              {grupo.etiqueta}
            </h3>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
              {grupo.items.length}
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
          </div>

          <ol className="relative space-y-2 pl-[26px]">
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-turf/40 via-slate-200 to-slate-200"
            />
            {grupo.items.map((h, i) => (
              <li key={`${h.match_id}-${i}`}>
                <FilaPartido h={h} posMap={posMap} canViewPeerScores={canViewPeerScores} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function FilaPartido({ h, posMap, canViewPeerScores }) {
  const partes = partesDeFecha(h.match_date);
  const stats = h.stats || {};
  const chips = [
    stats.goals > 0 && { icon: Target, valor: stats.goals, label: 'goles' },
    stats.assists > 0 && { icon: Users, valor: stats.assists, label: 'asistencias' },
    stats.saves > 0 && { icon: Hand, valor: stats.saves, label: 'atajadas' },
  ].filter(Boolean);

  const auto = !canViewPeerScores && h.self_evaluation?.score != null;

  return (
    <Link
      to={`/partidos/${h.match_id}`}
      data-testid={`history-match-${h.match_id}`}
      className="group relative block rounded-2xl border border-slate-100 bg-white p-3 pl-4 shadow-sm transition-all hover:border-turf/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <span
        aria-hidden="true"
        className="absolute -left-[26px] top-3 grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white font-heading text-sm font-bold leading-none tabular-nums text-slate-700 shadow-sm transition-colors group-hover:border-turf group-hover:bg-turf group-hover:text-white motion-reduce:transition-none"
      >
        {partes ? partes.dia : '—'}
      </span>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{h.match_title}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {h.position_played && (
              <span className="inline-flex items-center rounded-full bg-turf/10 px-2 py-0.5 text-[11px] font-semibold text-turf-accessible">
                {posMap[h.position_played] || h.position_played}
              </span>
            )}
            {h.team && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                <Shirt className="h-3 w-3" aria-hidden="true" />
                Equipo {h.team}
              </span>
            )}
            {chips.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-200"
                title={`${c.valor} ${c.label}`}
              >
                <c.icon className="h-3 w-3 text-slate-600" aria-hidden="true" />
                <span className="tabular-nums">{c.valor}</span>
                <span className="sr-only">{c.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canViewPeerScores && h.avg_rating && <RatingBadge value={h.avg_rating} size="lg" />}
          {auto && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Auto
              </span>
              <span className="tabular-nums">{h.self_evaluation.score}</span>
            </span>
          )}
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none',
            )}
          />
        </div>
      </div>
    </Link>
  );
}
