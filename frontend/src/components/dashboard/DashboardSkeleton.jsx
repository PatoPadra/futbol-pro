import React from 'react';

/**
 * Esqueleto del panel. Copia el layout real (franja de bienvenida, fila de
 * métricas, título de sección y tarjetas) para que al terminar de cargar no
 * salte todo de lugar.
 */
export default function DashboardSkeleton() {
  return (
    <div className="page-container" data-testid="dashboard-skeleton">
      <div className="animate-pulse">
        <div className="mb-5 h-[196px] rounded-3xl bg-slate-200/80 md:mb-6 md:h-[216px]" />

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-2xl bg-slate-200/70" />
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-slate-200/80" />
            <div className="h-6 w-44 rounded bg-slate-200/80" />
          </div>
          <div className="h-4 w-20 rounded bg-slate-200/60" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[228px] rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
