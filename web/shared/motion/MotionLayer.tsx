'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createBurst, prefersReducedMotion } from './particles';

const REVEAL_SELECTOR = '[data-reveal]:not(.is-visible)';
const BURST_SELECTOR = '.btn-primary, [data-burst]';
const BURST_COUNT = 12;
const CLEANUP_GRACE_MS = 150;

/** Fades `[data-reveal]` elements in as they scroll into view (hidden only under html.motion-ok). */
function useScrollReveal(pathname: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('motion-ok')) return;
    root.classList.add('reveal-ready');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);
}

/** XP-orb burst from the pointer when a primary button is clicked. */
function useParticleBurst(layerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const layer = layerRef.current;
      const target = event.target instanceof Element ? event.target.closest(BURST_SELECTOR) : null;
      if (!layer || !target || prefersReducedMotion() || typeof Element.prototype.animate !== 'function') return;
      // Keyboard activation reports (0, 0); burst from the button centre instead.
      const box = target.getBoundingClientRect();
      const x = event.clientX || box.left + box.width / 2;
      const y = event.clientY || box.top + box.height / 2;

      for (const p of createBurst(BURST_COUNT)) {
        const dot = document.createElement('span');
        dot.className = 'xp-orb';
        dot.style.cssText = `left:${x}px;top:${y}px;width:${p.size}px;height:${p.size}px;background:${p.color}`;
        layer.appendChild(dot);
        const animation = dot.animate(
          [
            { transform: 'translate(-50%, -50%)', opacity: 1 },
            { transform: `translate(calc(-50% + ${p.peakX}px), calc(-50% + ${p.peakY}px))`, opacity: 1, offset: 0.4 },
            { transform: `translate(calc(-50% + ${p.endX}px), calc(-50% + ${p.endY}px))`, opacity: 0 },
          ],
          { duration: p.duration, easing: 'cubic-bezier(.2,.7,.4,1)' },
        );
        animation.onfinish = () => dot.remove();
        animation.oncancel = () => dot.remove();
        // Background tabs pause the animation clock, so onfinish may never fire there.
        window.setTimeout(() => dot.remove(), p.duration + CLEANUP_GRACE_MS);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [layerRef]);
}

export function MotionLayer() {
  const pathname = usePathname();
  const layerRef = useRef<HTMLDivElement>(null);
  useScrollReveal(pathname);
  useParticleBurst(layerRef);
  return <div ref={layerRef} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden />;
}
