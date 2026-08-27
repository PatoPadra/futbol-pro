import React from 'react';
import { Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import TeamCrest from './TeamCrest';
import { TEAM_IDENTITY } from './teamIdentity';

/**
 * Como quedo repartida la fuerza entre los dos equipos.
 *
 * El porcentaje de balance solo no dice para que lado se fue la balanza, asi
 * que cuando hay valores de los dos equipos (los ve el organizador) se dibuja
 * la reparticion real con los escudos en cada punta.
 *
 * DOS COSAS QUE CAMBIARON, Y POR QUE:
 *
 * 1. Los umbrales bajaron. El backend ahora mide la brecha de PROMEDIOS y no
 *    la de sumas, que estaba diluida por el tamaño del equipo: un punto de
 *    diferencia por jugador daba 0.909 en 11v11 y la pantalla decia "muy
 *    parejo". Con la formula nueva ese mismo reparto da 0.667, asi que los
 *    tramos naranja y rojo —que antes practicamente no se ejercitaban— ahora
 *    aparecen de verdad.
 *
 * 2. Existe el estado "a ciegas". Cuando el plantel no tiene puntajes con los
 *    que distinguir a nadie (grupo nuevo: el prior neutro y el piso de
 *    confianza aplastan a todos alrededor de 5.9), el balance da altisimo
 *    porque los equipos son igual de desconocidos, no porque esten bien
 *    armados. Mostrar 97% ahi es mentir con un numero. Se muestra un guion.
 *
 * El numero grande va siempre en tinta neutra: el color acompaña en el chip y
 * la etiqueta, no titula. Un 78% sigue siendo un partido jugable y no merece un
 * 4xl teñido de alarma.
 */

/** Por debajo de esta diferencia entre el mejor y el peor, no hay con que balancear. */
const SPREAD_MINIMO = 0.5;

function tono(pct) {
  if (pct >= 90) {
    return {
      acento: 'text-turf-accessible',
      chip: 'bg-turf/10 border-turf/25',
      etiqueta: 'Muy parejo',
      detalle: 'Los dos equipos valen practicamente lo mismo.',
    };
  }
  if (pct >= 75) {
    return {
      acento: 'text-orange-accessible',
      chip: 'bg-orange/10 border-orange/25',
      etiqueta: 'Aceptable',
      detalle: 'Hay una diferencia, pero el partido se juega.',
    };
  }
  return {
    acento: 'text-amber-700',
    chip: 'bg-amber-50 border-amber-300',
    etiqueta: 'Desparejo',
    detalle: 'Conviene mover algun jugador antes de arrancar.',
  };
}

/**
 * Sin puntajes que distingan a nadie, el porcentaje no significa nada.
 *
 * En gris y con guion en vez de numero: el mismo lenguaje que ya usa el panel
 * de rating para la confianza, que muestra el dato Y lo explica en texto en vez
 * de confiar solo en el color.
 */
const A_CIEGAS = {
  acento: 'text-slate-400',
  chip: 'bg-slate-100 border-slate-200',
  etiqueta: 'Sin datos suficientes',
  detalle: 'Todavia no hay puntajes cargados: los equipos se armaron al azar. Despues de dos o tres fechas esto empieza a significar algo.',
};

export default function BalanceMeter({ pct = 0, valorA, valorB, spread, className, testId }) {
  // `spread` es opcional: una generacion vieja no lo tiene guardado, y en ese
  // caso vale mas mostrar el numero de siempre que un guion sin explicacion.
  const aCiegas = typeof spread === 'number' && spread < SPREAD_MINIMO;
  const t = aCiegas ? A_CIEGAS : tono(pct);

  const tieneValores = typeof valorA === 'number' && typeof valorB === 'number' && (valorA + valorB) > 0;
  const parteA = tieneValores ? Math.round((valorA / (valorA + valorB)) * 100) : 50;

  return (
    <div
      className={cn('rounded-3xl border border-slate-200 bg-white p-4 shadow-lift sm:p-5', className)}
      data-testid={testId}
      data-estado={aCiegas ? 'a-ciegas' : 'medido'}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', t.chip)}>
          <Scale className={cn('h-5 w-5', t.acento)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Balance del reparto</p>
          <p className={cn('text-sm font-semibold', t.acento)}>{t.etiqueta}</p>
        </div>
        <p className="font-heading text-4xl font-bold leading-none tabular-nums text-slate-900">
          {aCiegas ? (
            <span className="text-slate-400" aria-label="Sin datos suficientes">&mdash;</span>
          ) : (
            <>
              {pct}
              <span className="text-xl">%</span>
            </>
          )}
        </p>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">{t.detalle}</p>

      {tieneValores && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <TeamCrest team="A" tamanio="xs" />
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              {/* Con datos, cada equipo con su color. A ciegas la barra sigue
                  dibujandose —el reparto es un hecho, no una estimacion— pero en
                  gris, para que no parezca que dice algo que no dice. */}
              <div
                className={cn('h-full', aCiegas ? 'bg-slate-300' : TEAM_IDENTITY.A.barra)}
                style={{ width: `${parteA}%` }}
              />
              <div className={cn('h-full flex-1', aCiegas ? 'bg-slate-200' : TEAM_IDENTITY.B.barra)} />
            </div>
            <TeamCrest team="B" tamanio="xs" />
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">
            Valor total: <span className="font-semibold text-slate-900">{valorA.toFixed(2)}</span> del equipo A
            {' contra '}
            <span className="font-semibold text-slate-900">{valorB.toFixed(2)}</span> del equipo B
          </p>
        </div>
      )}
    </div>
  );
}
