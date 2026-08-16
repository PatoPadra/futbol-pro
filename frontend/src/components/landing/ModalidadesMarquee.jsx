import React from 'react';

/** Lo que se puede organizar con la app. Es la lista real, no decoración vacía. */
const MODALIDADES = [
  'Fútbol 5',
  'Fútbol 7',
  'Fútbol 8',
  'Fútbol 11',
  'Masculino',
  'Femenino',
  'Mixto',
  'Amateur',
  'Profesional',
];

/**
 * Media cinta. El truco del loop sin salto: la cinta entera contiene DOS mitades
 * idénticas y `animate-marquee` la corre exactamente -50%. Por eso el espacio
 * final (`pr-*`) va adentro de cada mitad: si el gap viviera en el contenedor
 * padre, las dos mitades no medirían lo mismo y el loop pegaría un tironcito.
 */
function Mitad({ decorativa = false }) {
  return (
    <ul
      aria-hidden={decorativa || undefined}
      aria-label={decorativa ? undefined : 'Modalidades y tipos de partido que podés organizar'}
      className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12"
    >
      {MODALIDADES.map((m) => (
        <li
          key={m}
          className="flex items-center gap-8 whitespace-nowrap font-heading text-lg font-bold uppercase tracking-[0.18em] text-white md:gap-12 md:text-xl"
        >
          {m}
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-turf-light" />
        </li>
      ))}
    </ul>
  );
}

export default function ModalidadesMarquee() {
  return (
    <section className="noise relative overflow-hidden border-y border-white/10 bg-pitch-dark py-4 md:py-5">
      <div aria-hidden="true" className="absolute inset-0 bg-pitch-stripes opacity-70" />
      <div className="fade-edges-x relative">
        <div className="flex w-max animate-marquee motion-reduce:animate-none">
          <Mitad />
          <Mitad decorativa />
        </div>
      </div>
    </section>
  );
}
