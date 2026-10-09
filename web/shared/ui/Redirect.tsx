'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/config/routes';

/**
 * Legacy-route stub for the static export (GitHub Pages has no server redirects).
 * A meta refresh covers no-JS visitors; the router handles everyone else.
 */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  const href = withBasePath(to);

  useEffect(() => {
    router.replace(`${to}${window.location.hash}`);
  }, [router, to]);

  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <div className="mx-auto max-w-md px-4 py-24 text-center text-sm text-fg-2">
        <p>此頁已搬到新位置 · This page has moved.</p>
        <a href={href} className="mt-3 inline-block text-accent underline">
          {to}
        </a>
      </div>
    </>
  );
}
