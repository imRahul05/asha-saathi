'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TabDef<K extends string> = { key: K; label: ReactNode; badge?: ReactNode };

type TabBarProps<K extends string> = {
  tabs: TabDef<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  /** Prefix for the tab element ids (ids must stay unique when two bars exist on the page) */
  idPrefix: string;
  className?: string;
};

/** A pill-shaped tab switcher with arrow-key navigation (role=tablist). */
export function TabBar<K extends string>({ tabs, value, onChange, ariaLabel, idPrefix, className }: TabBarProps<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === value);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].key);
    refs.current[tabs[next].key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('gap-1 rounded-full bg-asha-sand p-1 text-base font-bold', className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          ref={(el) => { refs.current[t.key] = el; }}
          id={`${idPrefix}-${t.key}`}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          tabIndex={value === t.key ? 0 : -1}
          onClick={() => onChange(t.key)}
          className={cn(
            'relative flex h-11 items-center justify-center gap-2 rounded-full px-2 transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/40',
            value === t.key ? 'bg-white text-asha-ink shadow-sm' : 'text-asha-muted hover:text-asha-ink',
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}
