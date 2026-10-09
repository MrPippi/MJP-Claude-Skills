'use client';

import { useEffect, useState } from 'react';
import type { Heading } from '@/shared/markdown/render';
import { useLanguage } from '@/shared/i18n';

interface TocProps {
  headings: Heading[];
  /** Optional display-text mapper (e.g. zh → en section names on skill pages). */
  labelFor?: (text: string) => string;
}

export function Toc({ headings, labelFor = (text) => text }: TocProps) {
  const { t } = useLanguage();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label={t.docs.toc} className="text-sm">
      <p className="eyebrow mb-3">{t.docs.toc}</p>
      <ul className="space-y-1.5 border-l border-line">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block border-l-2 py-0.5 leading-snug transition-colors ${h.level === 3 ? 'pl-6' : 'pl-3'} ${
                activeId === h.id ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg-2'
              }`}
            >
              {labelFor(h.text)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
