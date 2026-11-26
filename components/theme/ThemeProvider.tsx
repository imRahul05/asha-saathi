'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Routes that have been designed for dark mode. Everything else (sign-in, the call screen, the doctor dashboard)
// still uses fixed light surfaces, so it is forced to light until those screens are themed too.
const THEMED_ROUTES = new Set(['/']);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const themed = THEMED_ROUTES.has(pathname ?? '');
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={themed ? undefined : 'light'}
    >
      {children}
    </NextThemesProvider>
  );
}
