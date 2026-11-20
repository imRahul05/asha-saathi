import { ImageResponse } from 'next/og';
import { AshaMarkArt, MARK_ORANGE } from '@/components/brand/AshaMarkArt';

// iOS home-screen icon: the same character as app/icon.svg and the in-page BrandMark (iOS rounds the corners).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect width="64" height="64" fill={MARK_ORANGE} />
          {AshaMarkArt()}
        </svg>
      </div>
    ),
    { ...size },
  );
}
