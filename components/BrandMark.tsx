import { cn } from '@/lib/utils';
import { AshaMarkArt, MARK_ORANGE } from '@/components/brand/AshaMarkArt';

// The one ASHA Saathi mark. Same artwork as app/icon.svg (browser tab) and app/apple-icon.tsx.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-9 w-9 shrink-0 overflow-hidden rounded-[23%]', className)}
      role="img"
      aria-label="ASHA Saathi"
    >
      <rect width="64" height="64" fill={MARK_ORANGE} />
      <AshaMarkArt />
    </svg>
  );
}
