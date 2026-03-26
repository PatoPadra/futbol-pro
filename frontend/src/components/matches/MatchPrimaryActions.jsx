import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, Play, Share2, Shuffle, UserMinus, UserPlus } from 'lucide-react';

import { Button } from '../ui/button';

export default function MatchPrimaryActions({
  match,
  matchId,
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
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
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
          <UserMinus className="w-4 h-4 mr-2" />
          Darme de baja
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
          Cerrar Inscripciones
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
          {match.status === 'equipos_generados' ? 'Recalcular' : 'Generar'} Equipos
        </Button>
      )}

      {['equipos_generados', 'equipos_confirmados'].includes(match.status) && (
        <Link to={`/partidos/${matchId}/equipos`}>
          <Button data-testid="view-teams-btn" variant="outline" className="rounded-full px-6">
            Ver Equipos
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
          <Play className="w-4 h-4 mr-2" />
          Finalizar Partido
        </Button>
      )}

      {match.status === 'finalizado' && isRegistered && (
        <Link to={`/partidos/${matchId}/post-partido`}>
          <Button
            data-testid="post-match-btn"
            className="bg-orange hover:bg-orange-light text-white rounded-full px-6 font-bold uppercase"
          >
            Evaluar y Estadisticas
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
          <Copy className="w-4 h-4 mr-2" />
          Duplicar (+7 dias)
        </Button>
      )}

      <Button
        data-testid="share-whatsapp-btn"
        variant="outline"
        onClick={onShareWhatsApp}
        className="rounded-full px-5 border-green-200 text-green-700 hover:bg-green-50"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Compartir
      </Button>
    </div>
  );
}
