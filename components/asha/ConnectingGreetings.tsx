'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// While the voice agent is connecting: a hello that fades from one language to the next (for Auto), or one hello (for a fixed language).
// People with "reduce motion" switched on see a single still word.
export function ConnectingGreetings({ words, className }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    setI(0);
    if (words.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setShown(false);
      swap = setTimeout(() => {
        setI((x) => (x + 1) % words.length);
        setShown(true);
      }, 280);
    }, 1700);
    return () => {
      clearInterval(id);
      if (swap) clearTimeout(swap);
    };
  }, [words]);

  return (
    <p aria-hidden className={cn('min-h-10 text-2xl font-bold text-asha-teal transition-opacity duration-300', shown ? 'opacity-100' : 'opacity-0', className)}>
      {words[i] ?? ''}
    </p>
  );
}
