'use client';

import Link from 'next/link';
import { GITHUB_REPO_URL, GITHUB_CONTRIBUTE_URL } from '@/config/site';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';

export function Footer() {
  const { t } = useLanguage();

  const columns = [
    {
      title: t.footer.docs,
      links: [
        { label: t.footer.gettingStarted, href: ROUTES.gettingStarted },
        { label: t.footer.allSkills, href: ROUTES.skills },
        { label: t.footer.reference, href: '/docs/reference/packets' },
      ],
    },
    {
      title: t.footer.resources,
      links: [
        { label: t.footer.githubProject, href: GITHUB_REPO_URL, external: true },
        { label: t.footer.contributeGuide, href: GITHUB_CONTRIBUTE_URL, external: true },
        { label: t.footer.license, href: `${GITHUB_REPO_URL}/blob/main/LICENSE`, external: true },
      ],
    },
  ];

  return (
    <footer className="mt-auto bg-surface">
      <div className="pixel-divider" aria-hidden />
      <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2">
            <PixelIcon name="pickaxe" className="h-8 w-8" />
            <span className="font-serif text-lg font-semibold text-fg">MJP Claude Skills</span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-fg-2">{t.footer.tagline}</p>
          <p className="mt-4 font-pixel text-[12px] text-fg-3">Paper 1.21.11 · 26.2</p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="eyebrow mb-3">{col.title}</h3>
            <ul className="space-y-2 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  {'external' in link ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-fg-2 hover:text-accent">
                      {link.label} ↗
                    </a>
                  ) : (
                    <Link href={link.href} className="text-fg-2 hover:text-accent">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[90rem] px-4 py-4 text-[11px] leading-relaxed text-fg-3 sm:px-6">
          © {new Date().getFullYear()} MJP · {t.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
