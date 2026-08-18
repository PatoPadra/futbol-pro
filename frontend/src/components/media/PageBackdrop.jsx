import React from 'react';

import { fotoDeRuta } from '@/constants/fotos';

/**
 * Fondo fotografico de toda la pantalla, detras del contenido de la app.
 *
 * Por que existe: el shell era `bg-background` (#F8FAFC, blanco a todos los
 * efectos) con una malla verde al 16% en una esquina que no se percibia, y las
 * fotos vivian solo en la banda de 190px del encabezado. Resultado: paneles
 * blancos sobre fondo blanco y la sensacion de que la app no tenia imagenes.
 *
 * Cada pagina tiene DOS fotos: la de la banda del encabezado y esta, de fondo,
 * que ocupa la pantalla completa detras de un velo claro. Son distintas a
 * proposito — el mapa FONDOS de fotos.js las empareja por tema pero nunca
 * repite. Al principio el fondo reusaba la foto de la banda pensando que se
 * leeria como su eco; visto en la app se lee como la misma imagen puesta dos
 * veces, y no sirve.
 *
 * Sin desenfoque: se probo con 7px y despues 2px, y en los dos casos la foto no
 * se llegaba a entender. El blur ademas no aporta NADA al contraste en este
 * catalogo (ver abajo), asi que era costo puro.
 *
 * EL VELO NO ES DECORATIVO: 80% es el maximo de foto que entra sin romper el
 * texto. Medido sobre 8 fotos del catalogo, componiendo el velo sobre los
 * pixeles reales de cada una y buscando la zona mas oscura:
 *
 *     velo   foto visible   slate-600
 *     72%        28%          3.80:1   no llega
 *     75%        25%          4.13:1   no llega
 *     78%        22%          4.48:1   no llega (por dos centesimas)
 *     80%        20%          4.72:1   PASA  <-- estamos aca
 *     85%        15%          5.36:1   pasa, pero se ve menos foto
 *
 * Todo el texto secundario del shell se subio a slate-600 justamente para poder
 * estar en 80%: con slate-500 el peor caso daba 3.36:1. Si bajas el velo, medí
 * de nuevo — no lo estimes.
 *
 * Va fijo y decorativo: no scrollea con el contenido y es `aria-hidden`.
 */
export default function PageBackdrop({ pathname }) {
  const foto = fotoDeRuta(pathname);
  if (!foto) return null;

  return (
    <div
      aria-hidden="true"
      // -z-10 lo manda detras del contenido en flujo normal. Importante: el
      // contenedor de la app NO puede tener fondo opaco, o lo tapa.
      className="fixed inset-0 -z-10 overflow-hidden bg-background"
      data-testid="page-backdrop"
    >
      <img
        src={foto.src}
        alt=""
        // Sin blur. Medido: el desenfoque NO protege el contraste del texto en
        // este catalogo — las fotos mas oscuras tienen regiones negras grandes y
        // ni 60px de blur aclaran el centro de una mancha negra (la luminancia
        // minima se queda en 0 con cualquier valor). El contraste lo gobierna
        // solo el velo. O sea que el blur costaba nitidez y no devolvia nada.
        // Tampoco hace falta el scale para tapar bordes, porque no hay blur.
        className="h-full w-full object-cover saturate-[0.9]"
        style={{ objectPosition: '50% 40%' }}
        // Es lo mas grande de la pantalla y lo menos importante: siempre lazy,
        // asi no compite con el encabezado, que si es el LCP.
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-0 bg-white/80" />
      {/* La malla de marca queda encima de la foto: le da el tinte verde de la
          app sin volver a tapar la imagen. */}
      <div className="absolute inset-0 bg-mesh-turf" />
    </div>
  );
}
