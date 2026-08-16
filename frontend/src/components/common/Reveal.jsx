import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-media-preferences';

/**
 * Aparece cuando entra en viewport. Se dispara una sola vez: nada peor que una
 * sección que se re-anima cada vez que scrolleás para arriba.
 *
 * Con movimiento reducido renderiza el contenido visible y sin transición.
 */
export default function Reveal({
  children,
  delay = 0,
  /** 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade' */
  from = 'up',
  className,
  as: Tag = 'div',
  ...props
}) {
  const ref = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      setShown(true);
      return undefined;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  return (
    <Tag
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
        shown ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : HIDDEN[from],
        className,
      )}
      style={{ transitionDelay: shown && !reducedMotion ? `${delay}ms` : '0ms' }}
      {...props}
    >
      {children}
    </Tag>
  );
}

const HIDDEN = {
  up: 'opacity-0 translate-y-8',
  down: 'opacity-0 -translate-y-8',
  left: 'opacity-0 -translate-x-8',
  right: 'opacity-0 translate-x-8',
  scale: 'opacity-0 scale-95',
  fade: 'opacity-0',
};
