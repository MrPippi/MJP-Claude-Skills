'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavGroup, NavItem } from '../lib/nav';
import { PLATFORMS } from '@/features/skills/lib/platform';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import { useLanguage } from '@/shared/i18n';

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const { lang } = useLanguage();
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-sm transition-colors ${
        active ? 'border-accent bg-surface font-medium text-fg' : 'border-transparent text-fg-2 hover:bg-surface hover:text-fg'
      }`}
    >
      {item.icon && <PixelIcon name={item.icon} className="h-4 w-4 shrink-0" />}
      <span className="truncate">{lang === 'en' ? item.label.en : item.label.zh}</span>
    </Link>
  );
}

export function DocsSidebar({ nav }: { nav: NavGroup[] }) {
  const { t } = useLanguage();
  const pathname = usePathname().replace(/\/+$/, '') || '/';

  return (
    <nav aria-label={t.docs.menu} className="space-y-6">
      {nav.map((group) => (
        <div key={group.key}>
          <p className="eyebrow mb-2 px-2.5">{t.docs.sections[group.key]}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={pathname === item.href} />
              </li>
            ))}
          </ul>
          {group.subgroups?.map((sub) => {
            const platform = PLATFORMS.find((p) => p.id === sub.platform);
            const containsActive = sub.items.some((i) => i.href === pathname);
            return (
              <details key={sub.platform} open={containsActive || undefined} className="group mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg-2 hover:bg-surface hover:text-fg [&::-webkit-details-marker]:hidden">
                  <span className="font-pixel text-[12px] text-fg-3 transition-transform group-open:rotate-90">▶</span>
                  <span className={sub.platform === 'paper-nms' ? 'text-nms' : 'text-api'}>{platform?.label}</span>
                  <span className="ml-auto font-pixel text-[12px] text-fg-3">{sub.items.length}</span>
                </summary>
                <ul className="mt-0.5 space-y-0.5 border-l border-line pl-2 ml-3">
                  {sub.items.map((item) => (
                    <li key={item.href}>
                      <SidebarLink item={item} active={pathname === item.href} />
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
