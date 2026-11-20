'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

// Runs before paint in the browser; falls back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Tag = 'div' | 'li' | 'p' | 'h2' | 'h3' | 'section';

/**
 * Scroll reveal that is safe by default:
 * - Server HTML and anything already on screen stays visible (no flash, works without JS).
 * - Only content below the fold is held back, then eased in once when it nears the viewport.
 * - Only opacity/transform animate, so scrolling never has to re-layout.
 * - prefers-reduced-motion: everything stays visible.
 */
export function Reveal({
  children,
  delay = 0,
  from = 'up',
  as = 'div',
  className,
}: {
  children: ReactNode;
  delay?: number;
  from?: 'up' | 'left' | 'right' | 'scale';
  as?: Tag;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'visible' | 'pending' | 'in'>('visible');

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen
    setState('pending');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('in');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = as as 'div';
  return (
    <Component
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal={state === 'visible' ? undefined : state}
      data-from={from}
      style={{ '--d': `${delay}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </Component>
  );
}

/** Headline that eases in word by word when it scrolls into view. */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [state, setState] = useState<'visible' | 'pending' | 'in'>('visible');

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    setState('pending');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('in');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = text.split(' ');
  return (
    <h2 ref={ref} data-words={state === 'visible' ? undefined : state} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="word" style={{ '--i': i } as CSSProperties} aria-hidden>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </h2>
  );
}
