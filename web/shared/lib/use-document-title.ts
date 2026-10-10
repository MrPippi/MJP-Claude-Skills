'use client';

import { useEffect } from 'react';

/**
 * Keeps document.title at `title` while mounted. Next.js streams static metadata
 * into <head> after hydration, so a one-off assignment gets overwritten; watching
 * <head> re-applies the client title whenever that happens.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
