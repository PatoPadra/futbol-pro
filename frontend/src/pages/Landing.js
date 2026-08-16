import React from 'react';
import LandingNav from '@/components/landing/LandingNav';
import HeroSection from '@/components/landing/HeroSection';
import ModalidadesMarquee from '@/components/landing/ModalidadesMarquee';
import ShowcaseCarousel from '@/components/landing/ShowcaseCarousel';
import FeatureBento from '@/components/landing/FeatureBento';
import PitchSection from '@/components/landing/PitchSection';
import HowItWorks from '@/components/landing/HowItWorks';
import FinalCta from '@/components/landing/FinalCta';
import LandingFooter from '@/components/landing/LandingFooter';

/**
 * Pantalla de entrada.
 *
 * Orden pensado para que nunca haya dos superficies claras seguidas:
 *   hero (video) → cinta (verde oscuro) → carrusel (oscuro) → funciones (malla clara)
 *   → cancha (video) → tres pasos (gris claro) → cierre (oscuro) → pie (oscuro).
 *
 * Presupuesto de video: dos como máximo reproduciéndose a la vez. El hero es uno
 * y la sección de la cancha el otro; todo el resto es `clip.poster`.
 *
 * Se importa de forma estática en App.js (es el primer paint del usuario no
 * autenticado): nada de imports pesados acá.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      <LandingNav />
      <main>
        <HeroSection />
        <ModalidadesMarquee />
        <ShowcaseCarousel />
        <FeatureBento />
        <PitchSection />
        <HowItWorks />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
