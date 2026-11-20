import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, Noto_Sans_Devanagari, Noto_Sans_Kannada } from 'next/font/google';
import './globals.css';

// One font stack for three scripts. Browsers fall back per glyph: Latin -> Devanagari -> Kannada.
const latin = Inter({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
// Display face for headings on the landing page (Latin only; Indic glyphs fall back to the Noto faces).
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const deva = Noto_Sans_Devanagari({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-deva',
  display: 'swap',
});
const knda = Noto_Sans_Kannada({
  subsets: ['kannada', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-knda',
  display: 'swap',
});

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
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className={`h-full ${latin.variable} ${display.variable} ${deva.variable} ${knda.variable}`}>
      <body className="h-full min-h-screen bg-asha-cream font-asha text-asha-ink antialiased">
        {children}
      </body>
    </html>
  );
}
