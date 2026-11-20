// The ASHA Saathi character: a woman health worker (hair bun, bindi, saree pallu, medical-cross badge).
// Source of truth for BrandMark, app/apple-icon.tsx and app/favicon.ico/route.tsx.
// app/icon.svg is a static copy of the same artwork (keep them in sync). Drawn on a 64x64 canvas.
export const MARK_ORANGE = '#D9732A';

export function AshaMarkArt() {
  return (
    <g transform="translate(-3.2 -0.5) scale(1.1)">
      <path d="M6 64C6 51 16 45 32 45s26 6 26 19Z" fill="#165046" />
      <path d="M22 46.5 36 46 47 64H32Z" fill="#F6F0E4" />
      <path d="M14.5 54h7M18 50.5v7" stroke="#F6F0E4" strokeWidth="3" strokeLinecap="round" />
      <path d="M27.5 36h9v10.5c-2 2-7 2-9 0Z" fill="#E3A87B" />
      <ellipse cx="32" cy="27" rx="10.5" ry="12" fill="#EDBE94" />
      <circle cx="32" cy="9" r="5.3" fill="#1E2824" />
      <path d="M21 27C19.5 14 25.5 10.5 32 10.5S44.5 14 43 27C41 21 37.5 18.5 32.5 18C28 21 23.5 22.5 21 27Z" fill="#1E2824" />
      <circle cx="32" cy="21.5" r="1.7" fill="#A8201A" />
    </g>
  );
}
