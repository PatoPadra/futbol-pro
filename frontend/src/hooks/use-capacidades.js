import { useEffect, useState } from 'react';

import api from '@/lib/api';

/**
 * Que puede hacer esta persona, segun sus grupos.
 *
 * EXISTE PORQUE EL FRONT MIRABA EL EJE EQUIVOCADO. Hay dos roles con la misma
 * palabra:
 *
 *   users.role                -> admin | jugador          (quien sos en la app)
 *   group_members.member_role -> organizador | frecuente | invitado
 *                                                         (que podes hacer EN ESE GRUPO)
 *
 * El backend siempre autorizo por el segundo, que es el correcto: alguien puede
 * organizar un grupo y ser jugador comun en otro. El front preguntaba por el
 * global, asi que a un organizador de grupo no le aparecia ni el boton de crear
 * partido — justo el caso normal cuando el titular no puede y delega.
 *
 * La regla que fija este hook: **el front no deriva permisos, lee booleanos que
 * el backend calculo**. `/api/groups` ya devuelve `can_create_match`,
 * `can_manage`, `can_invite` y `can_rate_seed` por grupo.
 *
 * Falla en silencio a "no puedo": si la consulta se cae, esconder un boton es
 * mucho menos molesto que ofrecer una accion que despues rebota con 403.
 */
export function useCapacidades() {
  const [grupos, setGrupos] = useState(null);

  useEffect(() => {
    let vigente = true;
    api.get('/groups')
      .then((res) => { if (vigente) setGrupos(res.data || []); })
      .catch(() => { if (vigente) setGrupos([]); })
      .finally(() => {});
    return () => { vigente = false; };
  }, []);

  const cargando = grupos === null;
  const lista = grupos || [];

  return {
    cargando,
    grupos: lista,
    /** Tengo al menos un grupo donde puedo crear partidos. */
    puedeCrearPartido: lista.some((g) => g.can_create_match),
    /** Los torneos los arma quien organiza algun grupo. */
    puedeCrearTorneo: lista.some((g) => g.can_manage),
    /** Los grupos que puedo organizar, para preseleccionar o filtrar. */
    gruposQueOrganizo: lista.filter((g) => g.can_create_match),
  };
}

export default useCapacidades;
