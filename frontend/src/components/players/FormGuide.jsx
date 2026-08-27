import React from 'react';
import { Check, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * La racha del jugador: los últimos partidos y su cuadro de ganados y perdidos.
 *
 * Dos datos que contestan preguntas distintas y por eso van juntos pero
 * separados: la tira dice CÓMO VIENE (los últimos diez) y el cuadro dice CÓMO LE
 * FUE (todos los partidos con resultado). Mezclarlos en un solo número haría que
 * no se pueda contestar ninguna de las dos.
 *
 * La tira se lee de izquierda a derecha, igual que el tiempo: el de más a la
 * derecha es el último que jugó.
 *
 * El color no es la única señal. Cada resultado tiene su propia forma — tilde,
 * cruz o guión — así que un daltónico lee la racha igual que cualquiera, y
 * además cada casillero lleva su descripción para el lector de pantalla.
 */
const RESULTADOS = {
  ganado: {
    icono: Check,
    chip: 'border-turf bg-turf-btn text-white',
    label: 'Ganado',
  },
  empatado: {
    icono: Minus,
    chip: 'border-slate-300 bg-slate-200 text-slate-700',
    label: 'Empatado',
  },
  perdido: {
    icono: X,
    chip: 'border-red-500 bg-red-500 text-white',
    label: 'Perdido',
  },
};

/** "12/03" — corta y sin depender de la zona horaria del navegador. */
function diaYMes(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''));
  return m ? `${m[3]}/${m[2]}` : null;
}

function Casillero({ fila, esUltimo }) {
  const tono = RESULTADOS[fila.outcome] || RESULTADOS.empatado;
  const Icono = tono.icono;
  const marcador = `${fila.goals_for}-${fila.goals_against}`;
  const cuando = diaYMes(fila.match_date);
  const rival = fila.opponent_name ? ` vs ${fila.opponent_name}` : '';
  const descripcion = `${tono.label} ${marcador}${rival}${cuando ? `, ${cuando}` : ''}`;

  return (
    <li className="shrink-0">
      <span
        title={descripcion}
        className={cn(
          'grid h-6 w-6 place-items-center rounded-md border-2 sm:h-8 sm:w-8 sm:rounded-lg',
          tono.chip,
          // El último lleva un aro para que se vea cuál es el más reciente sin
          // tener que contar desde el borde.
          esUltimo && 'ring-2 ring-slate-900 ring-offset-2',
        )}
      >
        <Icono className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">{descripcion}</span>
      </span>
    </li>
  );
}

function Dato({ valor, label, tono }) {
  return (
    <div className="text-center">
      <p className={cn('font-heading text-2xl font-bold leading-none tabular-nums', tono)}>
        {valor}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
}

export default function FormGuide({ record, testId }) {
  if (!record) return null;

  const { played = 0, won = 0, drawn = 0, lost = 0, win_pct: pct = 0, form = [] } = record;

  // Sin un solo partido con resultado no hay racha que mostrar. Una tira de diez
  // guiones grises no informa nada y ocupa lo mismo que algo que sí informe.
  if (!played) {
    return (
      <section
        className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lift sm:p-6"
        data-testid={testId || 'form-guide'}
      >
        <h3 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
          Racha
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Todavía no hay partidos con resultado cargado. Cuando el organizador
          empiece a cargarlos, acá vas a ver cómo viene.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lift sm:p-6"
      data-testid={testId || 'form-guide'}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
            Racha
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            {form.length === 1 ? 'Último partido' : `Últimos ${form.length}`}, del más viejo al más nuevo
          </p>

          {/* Los casilleros achican en celular para que los diez entren sin
              scrollear: una racha que hay que arrastrar para ver deja de ser "de
              un vistazo", que es lo único que tiene que hacer. El overflow queda
              igual como red por si algún día son más de diez. */}
          <ol
            className="mt-3 flex gap-1 overflow-x-auto pb-1 sm:gap-1.5"
            data-testid="form-strip"
          >
            {form.map((fila, i) => (
              <Casillero key={fila.match_id} fila={fila} esUltimo={i === form.length - 1} />
            ))}
          </ol>
        </div>

        <dl
          className="grid shrink-0 grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
          data-testid="record-box"
        >
          <Dato valor={won} label="Gan" tono="text-turf-accessible" />
          <Dato valor={drawn} label="Emp" tono="text-slate-700" />
          <Dato valor={lost} label="Per" tono="text-red-600" />
          <Dato valor={`${pct}%`} label="Efec" tono="text-slate-900" />
        </dl>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        El cuadro cuenta los {played} {played === 1 ? 'partido' : 'partidos'} con
        resultado cargado. La efectividad es ganados sobre jugados.
      </p>
    </section>
  );
}
