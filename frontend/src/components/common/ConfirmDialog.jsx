import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Confirmacion de una accion que no se deshace.
 *
 * Existe porque la app tenia TRES niveles de confirmacion conviviendo y ninguno
 * enseñaba nada:
 *
 *   - nada, en las cuatro acciones de TournamentDetail (borrar el torneo,
 *     generar el fixture, generar las llaves, sacar un equipo). Un clic y listo,
 *     en la pantalla con mas datos cargados a mano de toda la app.
 *   - `window.confirm` nativo en MatchDetail, que rompe la app visualmente:
 *     tipografia del sistema, boton azul del navegador, cero identidad. Y encima
 *     el texto de la consecuencia se pierde en un parrafo del navegador.
 *   - `AlertDialog` bien hecho en GroupDetail y LinkGuestDialog.
 *
 * El tercero era el correcto, asi que este componente lo empaqueta para que sea
 * mas facil hacer lo bien que hacerlo mal.
 *
 * LA REGLA QUE EL USUARIO APRENDE: rojo + lista = no vuelve. Toast con
 * "Deshacer" = volves tocando. Por eso las consecuencias van enumeradas y no en
 * prosa: en una lista se cuentan de un vistazo, en un parrafo se leen en
 * diagonal.
 */
export default function ConfirmDialog({
  abierto,
  onCambio,
  titulo,
  descripcion,
  /** Que se pierde, en items. Se lee mucho mejor que un parrafo. */
  consecuencias = [],
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  /** 'riesgo' pinta el boton en destructivo. 'normal' para lo que no destruye nada. */
  tono = 'riesgo',
  cargando = false,
  onConfirmar,
  testId,
}) {
  const esRiesgo = tono === 'riesgo';
  const Icono = esRiesgo ? AlertTriangle : HelpCircle;

  return (
    <AlertDialog open={abierto} onOpenChange={(next) => !next && onCambio?.(false)}>
      <AlertDialogContent className="rounded-2xl" data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-xl border',
                esRiesgo
                  ? 'border-rose-200 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-slate-50 text-slate-600',
              )}
            >
              <Icono className="h-4 w-4" />
            </span>
            {titulo}
          </AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>

        {consecuencias.length > 0 && (
          <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {consecuencias.map((linea) => (
              <li key={linea} className="flex gap-2">
                <span aria-hidden="true" className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>{linea}</span>
              </li>
            ))}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={cargando}
            className="rounded-full font-bold uppercase tracking-wide"
            data-testid={testId ? `${testId}-cancel` : undefined}
          >
            {textoCancelar}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirmar?.();
            }}
            disabled={cargando}
            className={cn(
              'rounded-full font-bold uppercase tracking-wide',
              esRiesgo && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
            data-testid={testId ? `${testId}-confirm` : undefined}
          >
            {cargando ? 'Un momento...' : textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
