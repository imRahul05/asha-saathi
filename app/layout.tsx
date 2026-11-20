import type { Metadata, Viewport } from 'next';
import './globals.css';
// Self-hosted fonts (npm packages, bundled at build time). Next's Google-font loader downloads fonts while building, so one network
// hiccup could fail a whole deploy. Each package serves per-script files, so a phone only downloads the scripts it actually shows.
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';
import '@fontsource/noto-sans-kannada/400.css';
import '@fontsource/noto-sans-kannada/500.css';
import '@fontsource/noto-sans-kannada/600.css';
import '@fontsource/noto-sans-kannada/700.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#F6F0E4',
};

export const metadata: Metadata = {
  title: 'ASHA Saathi',
  description:
    'A voice copilot for ASHA health workers. Speak in Hindi, Kannada or English; it records the visit, flags high-risk pregnancies and alerts the doctor.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className="h-full">
      <body className="h-full min-h-screen bg-asha-cream font-asha text-asha-ink antialiased">
        {children}
      </body>
    </html>
  );
}
