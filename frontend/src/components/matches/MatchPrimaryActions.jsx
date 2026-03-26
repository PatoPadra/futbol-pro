import React from 'react';
import { Copy, Play, Share2, Shuffle, Trash2, UserMinus, UserPlus, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../ui/button';

export default function MatchPrimaryActions({
  match,
  isOrganizer,
  isRegistered,
  actionLoading,
  onRegister,
  onUnregister,
  onClose,
  onGenerateTeams,
  onFinalize,
  onDuplicate,
  onShareWhatsApp,
  onCancel,
  onDelete,
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {match.status === 'abierto' && !isRegistered && (
          <Button
            data-testid="register-for-match"
            onClick={onRegister}
            disabled={!!actionLoading}
            className="bg-turf hover:bg-turf-dark text-white rounded-full px-6 font-bold uppercase tracking-wider"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {actionLoading === 'register' ? 'Anotando...' : 'Anotarme'}
          </Button>
        )}

        {match.status === 'abierto' && isRegistered && (
          <Button
            data-testid="unregister-from-match"
            variant="outline"
            onClick={onUnregister}
            disabled={!!actionLoading}
            className="rounded-full px-6 border-red-200 text-red-600 hover:bg-red-50"
          >
            <UserMinus className="w-4 h-4 mr-2" /> Darme de baja
          </Button>
        )}

        {isOrganizer && match.status === 'abierto' && (
          <Button
            data-testid="close-registrations"
            variant="outline"
            onClick={onClose}
            disabled={!!actionLoading}
            className="rounded-full px-6"
          >
            Cerrar inscripciones
          </Button>
        )}

        {isOrganizer && ['cerrado', 'equipos_generados'].includes(match.status) && (
          <Button
            data-testid="generate-teams-btn"
            onClick={onGenerateTeams}
            disabled={!!actionLoading}
            className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase tracking-wider"
          >
            <Shuffle className="w-4 h-4 mr-2" />
            {match.status === 'equipos_generados' ? 'Recalcular' : 'Generar'} equipos
          </Button>
        )}

        {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
          <Link to={`/partidos/${match.id}/equipos`}>
            <Button data-testid="view-teams-btn" variant="outline" className="rounded-full px-6">
              Ver equipos
            </Button>
          </Link>
        )}

        {isOrganizer && match.status === 'equipos_confirmados' && (
          <Button
            data-testid="finalize-match-btn"
            onClick={onFinalize}
            disabled={!!actionLoading}
            className="bg-slate-800 text-white rounded-full px-6 font-bold uppercase"
          >
            <Play className="w-4 h-4 mr-2" /> Finalizar partido
          </Button>
        )}

        {match.status === 'finalizado' && isRegistered && (
          <Link to={`/partidos/${match.id}/post-partido`}>
            <Button
              data-testid="post-match-btn"
              className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase"
            >
              Evaluar y estadísticas
            </Button>
          </Link>
        )}

        {isOrganizer && (
          <Button
            data-testid="duplicate-match-btn"
            variant="outline"
            onClick={onDuplicate}
            disabled={!!actionLoading}
            className="rounded-full px-5"
          >
            <Copy className="w-4 h-4 mr-2" /> Duplicar (+7 días)
          </Button>
        )}

        <Button
          data-testid="share-whatsapp-btn"
          variant="outline"
          onClick={onShareWhatsApp}
          className="rounded-full px-5 border-green-200 text-green-700 hover:bg-green-50"
        >
          <Share2 className="w-4 h-4 mr-2" /> Compartir
        </Button>
      </div>

      {isOrganizer && ((!['cancelado', 'completado'].includes(match.status)) || onDelete) && (
        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">Zona sensible</p>
              <p className="text-sm text-slate-600">
                Cancelar oculta el partido como pendiente y lo deja registrado. Borrar elimina todo definitivamente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!['cancelado', 'completado'].includes(match.status) && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={!!actionLoading}
                  className="rounded-full border-red-200 text-red-700 hover:bg-red-100"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Cancelar partido
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  onClick={onDelete}
                  disabled={!!actionLoading}
                  className="rounded-full border-red-300 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Borrar definitivo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
