import { ImageResponse } from 'next/og';
import { AshaMarkArt, MARK_ORANGE } from '@/components/brand/AshaMarkArt';

// Some browsers and crawlers request /favicon.ico directly. Serve the same character as app/icon.svg.
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', borderRadius: 7, overflow: 'hidden' }}>
        <svg width="32" height="32" viewBox="0 0 64 64">
          <rect width="64" height="64" fill={MARK_ORANGE} />
          {AshaMarkArt()}
        </svg>
      </div>
    ),
    { width: 32, height: 32 },
  );
}
