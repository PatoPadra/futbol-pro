import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

import SectionPanel from '@/components/groups/SectionPanel';
import { Button } from '@/components/ui/button';

/**
 * Borrar el grupo.
 *
 * Vive abajo y aparte a proposito: es la unica accion de la pantalla que no se
 * puede deshacer, y arriba, al lado de "Crear partido", se toca por accidente.
 * El boton y su confirmacion son los mismos de antes.
 */
export default function GroupDangerZone({ groupName, onDelete }) {
  return (
    <SectionPanel
      icono={AlertTriangle}
      titulo="Borrar el grupo"
      descripcion={`Se borra ${groupName} con todos sus partidos y equipos generados. No se puede deshacer.`}
      tono="riesgo"
    >
      <Button
        variant="outline"
        onClick={onDelete}
        shape="pill"
        className="h-12 w-full border-2 border-red-300 bg-white px-6 text-red-700 hover:bg-red-100 hover:text-red-800 focus-visible:ring-destructive sm:w-auto"
        data-testid="group-delete-btn"
      >
        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Borrar grupo
      </Button>
    </SectionPanel>
  );
}
