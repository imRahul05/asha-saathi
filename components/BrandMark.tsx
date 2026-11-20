import { cn } from '@/lib/utils';

// The one ASHA Saathi mark. Same artwork as app/icon.svg (browser tab) and app/apple-icon.tsx.
export function BrandMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <span
      className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[22%] bg-asha-orange text-asha-night', className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn('h-[62%] w-[62%]', iconClassName)}
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
      </svg>
    </span>
  );
}
