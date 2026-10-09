'use client';

import { useEffect, type RefObject } from 'react';

const RESET_MS = 1500;

/**
 * Adds a copy button to every <pre> inside `containerRef`. Highlighting itself is
 * static HTML from the build; this is the only code-block JavaScript on the page.
 */
export function useCopyButtons(containerRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons: HTMLButtonElement[] = [];

    container.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector(':scope > .copy-btn')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-btn';
      button.textContent = 'COPY';
      button.setAttribute('aria-label', 'Copy code');
      button.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.innerText ?? pre.innerText;
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = 'COPIED';
        } catch {
          button.textContent = 'FAILED';
        }
        window.setTimeout(() => (button.textContent = 'COPY'), RESET_MS);
      });
      pre.appendChild(button);
      buttons.push(button);
    });

    return () => buttons.forEach((b) => b.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls re-run (HTML changes)
  }, deps);
}
