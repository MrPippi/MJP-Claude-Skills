'use client';

import { useEffect, useState } from 'react';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';
import { THEME_STORAGE_KEY } from './theme-script';
import { prefersReducedMotion } from '@/shared/motion/particles';

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

  const apply = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice applies for this page view only.
    }
    setTheme(next);
  };

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || prefersReducedMotion()) {
      apply(next);
      return;
    }
    // Circular day/night reveal growing from the toggle (see ::view-transition-new in motion.css).
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement.style;
    root.setProperty('--vt-x', `${x}px`);
    root.setProperty('--vt-y', `${y}px`);
    root.setProperty('--vt-r', `${radius}px`);
    document.startViewTransition(() => apply(next));
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
