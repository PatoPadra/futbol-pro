import { useEffect, useState } from 'react';

import api from '@/lib/api';

/**
 * Modos de partido, tipos (oficial/práctica) y valores de asistencia, tal como
 * los define el backend.
 *
 * La tabla de modos vive en `constants.py` y NO se repite acá. Si el front
 * tuviera su propia copia, tarde o temprano diría algo distinto — y lo que está
 * en juego no es una etiqueta sino qué pantallas se muestran y qué se le pide al
 * jugador después del partido.
 *
 * La respuesta es estática, así que se cachea a nivel de módulo: la promesa se
 * comparte entre todos los que monten el hook y sale una sola request por
 * sesión, monten las pantallas que monten.
 *
 * Si la request falla NO se rompe nada: las listas quedan vacías, el que las use
 * esconde el selector, y el partido se crea igual heredando el modo del grupo.
 * Un catálogo de etiquetas no puede ser la razón por la que no se pueda armar un
 * partido.
 */
const VACIO = {
  modes: [],
  types: [],
  attendance: [],
  trackableStats: [],
  defaultTrackedStats: [],
  defaultMode: null,
  defaultType: null,
};

let pedido = null;

function pedirCatalogos() {
  if (!pedido) {
    pedido = api
      .get('/match-catalogs')
      .then((res) => ({
        modes: res.data?.modes || [],
        types: res.data?.types || [],
        attendance: res.data?.attendance || [],
        trackableStats: res.data?.trackable_stats || [],
        defaultTrackedStats: res.data?.default_tracked_stats || [],
        defaultMode: res.data?.default_mode || null,
        defaultType: res.data?.default_type || null,
      }))
      .catch(() => {
        // Se descarta la promesa fallada para que el próximo que monte el hook
        // vuelva a intentar. Cachear el error dejaría la app sin catálogo hasta
        // recargar la página entera.
        pedido = null;
        return VACIO;
      });
  }
  return pedido;
}

export default function useMatchCatalogs() {
  const [catalogos, setCatalogos] = useState(VACIO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vigente = true;

    pedirCatalogos().then((data) => {
      if (!vigente) return;
      setCatalogos(data);
      setLoading(false);
    });

    return () => {
      vigente = false;
    };
  }, []);

  return { ...catalogos, loading };
}

/** Busca una entrada del catálogo por id, sin romper si no está. */
export function buscarEnCatalogo(lista, id) {
  return (lista || []).find((item) => item.id === id) || null;
}
