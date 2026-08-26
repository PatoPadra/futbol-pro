import React, { useEffect, useState } from 'react';
import { Check, Gauge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import SectionPanel from '@/components/groups/SectionPanel';
import OptionCards from '@/components/matches/OptionCards';
import useMatchCatalogs from '@/hooks/use-match-catalogs';
import { Button } from '@/components/ui/button';

/**
 * Modo por default de los partidos del grupo.
 *
 * El modo se elige una vez por grupo y no una vez por partido. El que juega
 * todos los martes lo mismo no tiene por qué contestar la misma pregunta
 * cincuenta y dos veces al año; cada partido igual lo puede pisar al crearse.
 *
 * Cambiarlo NO toca los partidos que ya existen, y eso está escrito en pantalla
 * a propósito: sin decirlo, cambiar el modo del grupo parece que fuera a
 * reescribir el historial. No lo hace — un partido que se jugó sin evaluaciones
 * no tiene evaluaciones que mostrar por más que el grupo pase a modo Pro.
 */
export default function GroupModePanel({ group, onSaved }) {
  const { modes, loading: loadingModes } = useMatchCatalogs();
  const [elegido, setElegido] = useState(group?.default_match_mode || '');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setElegido(group?.default_match_mode || '');
  }, [group?.default_match_mode]);

  if (!loadingModes && !modes.length) return null;

  const cambio = elegido && elegido !== group?.default_match_mode;

  const guardar = async () => {
    if (!cambio) return;
    setGuardando(true);
    try {
      await api.patch(`/groups/${group.id}`, { default_match_mode: elegido });
      toast.success('Modo del grupo actualizado');
      await onSaved?.();
    } catch (err) {
      setElegido(group?.default_match_mode || '');
      toast.error(err.response?.data?.detail || 'No se pudo guardar el modo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SectionPanel
      icono={Gauge}
      titulo="Modo de los partidos"
      descripcion="Con qué configuración arrancan los partidos nuevos de este grupo."
      testId="group-mode-panel"
      contentClassName="space-y-4"
    >
      <OptionCards
        options={modes}
        value={elegido}
        onChange={setElegido}
        disabled={guardando}
        name="Modo por default del grupo"
        testId="group-mode"
      />

      <p className="text-xs leading-relaxed text-slate-600">
        Los partidos que ya existen no cambian. Esto vale de acá en adelante, y al
        crear cada partido se puede elegir otro.
      </p>

      <Button
        type="button"
        onClick={guardar}
        disabled={!cambio || guardando}
        shape="pill"
        className="h-11 w-full bg-turf text-white shadow-lg shadow-turf/20 hover:bg-turf-dark disabled:active:scale-100"
        data-testid="save-group-mode-btn"
      >
        {guardando ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {guardando ? 'Guardando...' : 'Guardar modo'}
      </Button>
    </SectionPanel>
  );
}
