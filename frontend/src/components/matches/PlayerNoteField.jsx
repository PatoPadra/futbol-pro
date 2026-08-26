import React, { useEffect, useState } from 'react';
import { Check, Loader2, NotebookPen, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * La nota del organizador sobre un jugador en este partido.
 *
 * Es privada de quien la escribe: ni el jugador ni los demás organizadores del
 * grupo la ven. Eso está dicho en pantalla y no sólo implementado en el backend,
 * porque nadie escribe con confianza en un campo si no sabe quién lo lee.
 *
 * Arranca cerrada y ocupa un botón chico. Con veinte jugadores en la lista,
 * veinte textareas abiertas convierten la pantalla en un formulario; el punto es
 * que anotar sea la excepción, no la tarea.
 */
export default function PlayerNoteField({ nota, playerName, disabled, onSave }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(nota || '');
  const [guardando, setGuardando] = useState(false);

  // Si la nota cambia por debajo (se recargó el partido), el campo tiene que
  // mostrar lo guardado y no lo que quedó tipeado en una sesión anterior.
  useEffect(() => {
    setTexto(nota || '');
  }, [nota]);

  const tieneNota = Boolean(nota);
  const cambio = (texto || '').trim() !== (nota || '').trim();

  const guardar = async () => {
    if (!cambio) {
      setAbierto(false);
      return;
    }
    setGuardando(true);
    try {
      await onSave(texto);
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => {
    setTexto(nota || '');
    setAbierto(false);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto(true)}
        data-testid={`open-note-${playerName}`}
        className={cn(
          'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turf focus-visible:ring-offset-1',
          'motion-reduce:transition-none',
          tieneNota
            ? 'border-secondary/40 bg-secondary/10 text-secondary'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-label={
          tieneNota ? `Editar tu nota sobre ${playerName}` : `Escribir una nota sobre ${playerName}`
        }
      >
        <NotebookPen className="h-3 w-3 shrink-0" aria-hidden="true" />
        {tieneNota ? 'Con nota' : 'Nota'}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
      <label
        htmlFor={`nota-${playerName}`}
        className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600"
      >
        Tu nota sobre {playerName}
      </label>
      <Textarea
        id={`nota-${playerName}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Ej: se paró muy adelantado en el segundo tiempo"
        className="mt-1.5 bg-white text-sm"
        data-testid={`note-input-${playerName}`}
        autoFocus
      />
      <p className="mt-1 text-[11px] leading-snug text-slate-600">
        Sólo la ves vos. Ni el jugador ni los demás organizadores.
      </p>

      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={guardar}
          disabled={guardando}
          shape="pill"
          className="h-9 flex-1 bg-turf text-xs font-bold uppercase tracking-wide text-white hover:bg-turf-dark"
          data-testid={`save-note-${playerName}`}
        >
          {guardando ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          {/* Vaciar el campo borra la nota, y conviene que el botón lo diga. */}
          {texto.trim() ? 'Guardar' : 'Borrar nota'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={cancelar}
          disabled={guardando}
          shape="pill"
          className="h-9 border-2 border-slate-200 px-3 hover:border-slate-400"
          aria-label="Cancelar"
          data-testid={`cancel-note-${playerName}`}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
