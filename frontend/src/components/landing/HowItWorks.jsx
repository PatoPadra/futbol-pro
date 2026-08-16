import React from 'react';
import { CalendarPlus, UserPlus, Shuffle } from 'lucide-react';
import Reveal from '@/components/common/Reveal';

const PASOS = [
  {
    icon: CalendarPlus,
    title: 'Creá el partido',
    desc: 'Fecha, hora, cancha, modalidad y cupos. Queda abierto para que se anoten.',
  },
  {
    icon: UserPlus,
    title: 'Sumá jugadores',
    desc: 'Frecuentes con un toque, invitados con nombre y nivel. Vos ves quién está confirmado.',
  },
  {
    icon: Shuffle,
    title: 'Generá los equipos',
    desc: 'La app arma dos equipos parejos y los ubica en la canchita según su posición.',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal from="up" className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-turf-accessible">
            Tres pasos
          </span>
          <h2 className="mt-3 font-heading text-3xl font-bold uppercase tracking-tight text-slate-900 md:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-3 text-slate-600">
            Del «¿jugamos el jueves?» a los equipos armados, sin planillas ni discusiones.
          </p>
        </Reveal>

        <div className="relative mt-14">
          {/* Línea que une los pasos. Sólo en desktop: en mobile los pasos van
              uno abajo del otro y la línea no ayudaría a nada. */}
          <div
            aria-hidden="true"
            className="absolute left-[16.6%] right-[16.6%] top-8 hidden h-0.5 bg-gradient-to-r from-turf/0 via-turf/45 to-turf/0 md:block"
          />

          <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {PASOS.map((p, i) => (
              <Reveal
                key={p.title}
                as="li"
                from="up"
                delay={i * 140}
                className="flex flex-col items-center text-center"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-turf text-2xl font-heading font-bold text-white shadow-lift-turf ring-8 ring-slate-50">
                  {i + 1}
                </span>
                <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
                  <p.icon className="h-5 w-5 text-turf-accessible" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-xl font-bold uppercase tracking-tight text-slate-900">
                  {p.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
