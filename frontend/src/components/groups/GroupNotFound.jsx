import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Users } from 'lucide-react';

import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

/** El grupo no existe o no tenemos acceso. Mismos botones y testids de antes. */
export default function GroupNotFound({ onRetry }) {
  return (
    <div className="page-container mx-auto max-w-3xl" data-testid="group-not-found">
      <EmptyState
        variante={1}
        icono={Users}
        titulo="No encontramos el grupo"
        descripcion="Puede que lo hayan borrado, o que no tengas acceso a él."
        accion={
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={onRetry}
              shape="pill"
              className="h-12 border-2 border-white/40 bg-white/10 px-6 text-white hover:bg-white/20 hover:text-white"
              data-testid="group-not-found-retry"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Reintentar
            </Button>
            <Link to="/dashboard">
              <Button
                shape="pill"
                className="h-12 bg-turf-btn px-6 text-white hover:bg-turf-btn-dark"
                data-testid="group-not-found-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Volver al inicio
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
