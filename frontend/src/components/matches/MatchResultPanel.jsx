import React, { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Scale, Trophy, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * El resultado del partido: el marcador y la nota de contexto.
 *
 * Va arriba de todo una vez jugado el partido porque es lo primero que alguien
 * quiere saber cuando abre un partido de la semana pasada. Antes de eso no se
 * muestra: un marcador vacío en un partido que todavía no se jugó sólo invita a
 * cargar cualquier cosa.
 *
 * Los dos lados se llaman `home` y `away`, y las etiquetas vienen resueltas del
 * backend. Hoy son siempre Equipo A y Equipo B; el día que exista el modo con DT
 * van a ser nuestro equipo y el rival, y esta pantalla no se entera.
 *
 * La nota es el contexto que explica un resultado raro ("faltaron tres",
 * "llovía"). Importa más de lo que parece: cuando el resultado empiece a mover el
 * puntaje de los jugadores, es lo que permite entender un 6 a 0 sin culpar a
 * nadie.
 */

/** Un campo vacío NO es cero: `Number('')` da 0 y guardaría un 0-0 inventado. */
const esGolValido = (valor) =>
  valor !== '' && Number.isInteger(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 99;

/** Por debajo de esto el partido estaba parejo y no había nada que acertar. */
const MARGEN_PAREJO = 0.06;

/**
 * Qué había predicho el balanceador y qué pasó.
 *
 * Es la única parte de la app donde el algoritmo rinde cuentas. Hasta ahora
 * armaba los equipos, decía "balance 0.97" y no se enteraba nunca de que había
 * terminado 6 a 0. Mostrarlo tiene dos efectos: el organizador entiende por qué
 * el partido salió como salió, y el que desconfía del armado automático puede
 * ver si le acierta o no en vez de tener que creer.
 */
function Pronostico({ esperado, resultado, homeLabel, awayLabel }) {
  if (esperado == null) return null;

  const local = Math.round(esperado * 100);
  const visitante = 100 - local;
  const parejo = Math.abs(esperado - 0.5) < MARGEN_PAREJO;
  const empate = resultado.home_score === resultado.away_score;
  const ganoLocal = resultado.home_score > resultado.away_score;

  let veredicto;
  if (empate) {
    veredicto = parejo ? 'Los daba parejos, y terminó empatado' : 'Terminó empatado';
  } else if (parejo) {
    veredicto = 'Los daba parejos: podía salir para cualquier lado';
  } else {
    const acerto = (esperado > 0.5) === ganoLocal;
    veredicto = acerto ? 'Le acertó' : 'Sorpresa: ganó el que venía de atrás';
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
      data-testid="result-forecast"
    >
      <div className="flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
          Antes de jugar
        </p>
      </div>

      {/* La barra es decorativa: los dos porcentajes están escritos al lado. */}
      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span className="tabular-nums">{local}%</span>
        <span aria-hidden="true" className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <span className="h-full bg-slate-700" style={{ width: `${local}%` }} />
          <span className="h-full bg-orange" style={{ width: `${visitante}%` }} />
        </span>
        <span className="tabular-nums">{visitante}%</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold">{veredicto}.</span>{' '}
        <span className="text-slate-600">
          Le daba {local}% a {homeLabel} y {visitante}% a {awayLabel}.
        </span>
      </p>
    </div>
  );
}

function Marcador({ label, goles, gano }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </p>
      <p
        className={cn(
          'font-heading text-4xl font-bold leading-none tabular-nums sm:text-5xl',
          gano ? 'text-turf-accessible' : 'text-slate-900',
        )}
      >
        {goles}
      </p>
    </div>
  );
}

export default function MatchResultPanel({
  match,
  canManage,
  onSaved,
  api,
  onError,
}) {
  const resultado = match?.result || null;
  const jugado = ['finalizado', 'completado'].includes(match?.status);

  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Si el partido se recarga por debajo, los campos tienen que mostrar el dato
  // nuevo y no lo que quedó tipeado de antes.
  useEffect(() => {
    setLocal(resultado?.home_score ?? '');
    setVisitante(resultado?.away_score ?? '');
    setNota(resultado?.notes ?? '');
  }, [resultado?.home_score, resultado?.away_score, resultado?.notes]);

  if (!jugado) return null;
  if (!resultado && !canManage) return null;

  const valido = esGolValido(local) && esGolValido(visitante);

  const guardar = async () => {
    if (!valido) return;
    setGuardando(true);
    try {
      await api.put(`/matches/${match.id}/result`, {
        home_score: Number(local),
        away_score: Number(visitante),
        notes: nota.trim() || null,
      });
      setEditando(false);
      await onSaved?.();
    } catch (err) {
      onError?.(err);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => {
    setLocal(resultado?.home_score ?? '');
    setVisitante(resultado?.away_score ?? '');
    setNota(resultado?.notes ?? '');
    setEditando(false);
  };

  const mostrandoFormulario = editando || !resultado;

  return (
    <section
      className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lift"
      data-testid="match-result-panel"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange/10 text-orange-accessible"
          >
            <Trophy className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900 sm:text-lg">
              Resultado
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {resultado
                ? `Lo cargó ${resultado.loaded_by_name || 'el organizador'}`
                : 'Cargá cómo terminó el partido.'}
            </p>
          </div>
        </div>

        {resultado && canManage && !editando && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            onClick={() => setEditando(true)}
            className="h-11 shrink-0 border-2 border-slate-200 hover:border-slate-400"
            data-testid="edit-result-btn"
          >
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" /> Corregir
          </Button>
        )}
      </header>

      <div className="p-4 sm:p-5">
        {mostrandoFormulario ? (
          <div className="space-y-4">
            <div className="flex items-end justify-center gap-3 sm:gap-5">
              <div className="min-w-0 flex-1 text-center">
                <label
                  htmlFor="resultado-local"
                  className="mb-1.5 block truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600"
                >
                  {match.home_label || 'Equipo A'}
                </label>
                <Input
                  id="resultado-local"
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  className="h-16 bg-slate-50 text-center font-heading text-3xl font-bold tabular-nums"
                  data-testid="result-home-input"
                />
              </div>

              <span aria-hidden="true" className="pb-5 font-heading text-2xl text-slate-400">
                -
              </span>

              <div className="min-w-0 flex-1 text-center">
                <label
                  htmlFor="resultado-visitante"
                  className="mb-1.5 block truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600"
                >
                  {match.away_label || 'Equipo B'}
                </label>
                <Input
                  id="resultado-visitante"
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={visitante}
                  onChange={(e) => setVisitante(e.target.value)}
                  className="h-16 bg-slate-50 text-center font-heading text-3xl font-bold tabular-nums"
                  data-testid="result-away-input"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="resultado-nota"
                className="mb-1.5 block text-sm font-semibold text-slate-900"
              >
                Nota del partido (opcional)
              </label>
              <Textarea
                id="resultado-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ej: faltaron tres y se jugó 4 contra 4"
                className="bg-slate-50"
                data-testid="result-notes-input"
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Lo que explique un resultado raro. Dentro de tres meses nadie se
                acuerda de que llovía.
              </p>
            </div>

            {!valido && (
              <p className="text-center text-xs text-slate-600" data-testid="result-hint">
                Cargá los goles de los dos equipos (números enteros, de 0 a 99).
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                onClick={guardar}
                disabled={guardando || !valido}
                shape="pill"
                className="h-11 flex-1 bg-turf text-white shadow-lg shadow-turf/20 hover:bg-turf-dark disabled:active:scale-100"
                data-testid="save-result-btn"
              >
                {guardando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {guardando ? 'Guardando...' : 'Guardar resultado'}
              </Button>

              {resultado && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelar}
                  disabled={guardando}
                  shape="pill"
                  className="h-11 border-2 border-slate-200 hover:border-slate-400 sm:flex-1"
                  data-testid="cancel-result-btn"
                >
                  <X className="mr-2 h-4 w-4" aria-hidden="true" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 sm:gap-6">
              <Marcador
                label={match.home_label || 'Equipo A'}
                goles={resultado.home_score}
                gano={resultado.home_score > resultado.away_score}
              />
              <span aria-hidden="true" className="font-heading text-2xl text-slate-300">
                -
              </span>
              <Marcador
                label={match.away_label || 'Equipo B'}
                goles={resultado.away_score}
                gano={resultado.away_score > resultado.home_score}
              />
            </div>

            {resultado.home_score === resultado.away_score && (
              <p className="text-center text-sm font-semibold text-slate-600">
                {resultado.home_penalties != null
                  ? `Empate, ${resultado.home_penalties > resultado.away_penalties ? 'ganamos' : 'perdimos'} ${resultado.home_penalties}-${resultado.away_penalties} por penales`
                  : 'Empate'}
              </p>
            )}

            {resultado.from_fixture && match.tournament_name && (
              <p
                className="rounded-2xl border border-secondary/30 bg-secondary/5 px-4 py-2.5 text-center text-xs font-semibold text-secondary"
                data-testid="result-from-tournament"
              >
                Este resultado cuenta para {match.tournament_name}. Al corregirlo
                acá también se corrige la llave.
              </p>
            )}

            {resultado.notes && (
              <p
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700"
                data-testid="result-notes"
              >
                {resultado.notes}
              </p>
            )}

            <Pronostico
              esperado={resultado.expected_home}
              resultado={resultado}
              homeLabel={match.home_label || 'Equipo A'}
              awayLabel={match.away_label || 'Equipo B'}
            />
          </div>
        )}
      </div>
    </section>
  );
}
