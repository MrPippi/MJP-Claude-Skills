'use client';

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';

export function NotFoundClient() {
  const { t } = useLanguage();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <PixelIcon name="creeper" className="h-24 w-24" title="Creeper" />
      <p className="mt-8 font-pixel text-5xl text-accent">404</p>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-fg">{t.notFound.title}</h1>
      <p className="mt-3 text-fg-2">{t.notFound.description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={ROUTES.home} className="btn-pixel btn-primary">
          {t.notFound.backHome}
        </Link>
        <Link href={ROUTES.docs} className="btn-pixel btn-ghost">
          {t.notFound.browseDocs}
        </Link>
      </div>
    </div>
  );
}
