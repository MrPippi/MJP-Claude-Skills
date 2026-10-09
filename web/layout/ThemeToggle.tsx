'use client';

import { useEffect, useState } from 'react';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';
import { THEME_STORAGE_KEY } from './theme-script';

type Theme = 'light' | 'dark';

function effectiveTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(effectiveTheme());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(effectiveTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice applies for this page view only.
    }
    setTheme(next);
  };

  const label = theme === 'dark' ? t.header.themeToLight : t.header.themeToDark;

  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={`icon-btn ${className}`}>
      {/* Both glyphs render server-side; CSS shows the right one before hydration. */}
      <PixelIcon name="sun" className="only-dark h-4 w-4" />
      <PixelIcon name="moon" className="only-light h-4 w-4" />
    </button>
  );
}
