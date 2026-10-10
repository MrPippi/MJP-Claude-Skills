'use client';

import Link from 'next/link';
import type { SkillMeta } from '@/shared/types/skill';
import type { DocLink } from '@/features/docs/registry';
import { SkillGrid } from '@/features/skills/components/SkillGrid';
import { getPlatform, PLATFORMS } from '@/features/skills/lib/platform';
import { HeroBackdrop, HeroLandscape } from './HeroScene';
import { HeroTerminal } from './HeroTerminal';
import { ROUTES } from '@/config/routes';
import { GITHUB_CONTRIBUTE_URLS } from '@/config/site';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { format, useLanguage } from '@/shared/i18n';
import { revealDelay } from '@/shared/motion/reveal';

interface HomePageClientProps {
  skills: SkillMeta[];
  featuredSkills: SkillMeta[];
  referenceDocs: DocLink[];
}

const MC_VERSIONS = ['1.21.11', '26.2'];
const STEP_ICONS: PixelIconName[] = ['chest', 'sign', 'command'];
const FEATURED_LIMIT = 6;

function SectionHeading({ label, title, action }: { label: string; title: string; action?: React.ReactNode }) {
  return (
    <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{label}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-fg">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function HomePageClient({ skills, featuredSkills, referenceDocs }: HomePageClientProps) {
  const { t, lang } = useLanguage();
  const h = t.home;
  const countFor = (id: string) => skills.filter((s) => getPlatform(s) === id).length;

  const stats = [
    { value: skills.length, label: h.statsSkills },
    { value: PLATFORMS.length, label: h.statsPlatforms },
    { value: MC_VERSIONS.length, label: h.statsVersions },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-10 pt-16 sm:px-6 sm:pb-14 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-[3px] border border-line-strong bg-bg/70 px-2 py-1 font-pixel text-[12px] uppercase text-fg-2">
              <span className="h-1.5 w-1.5 bg-api" />
              {skills.length} skills · {MC_VERSIONS.join(' · ')}
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-6xl">
              {h.titleLead}
              <br />
              <span className="text-accent">{h.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-fg-2 sm:text-lg">{h.heroDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={ROUTES.gettingStarted} className="btn-pixel btn-primary">
                {h.ctaPrimary}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href={ROUTES.skills} className="btn-pixel btn-ghost">
                {h.ctaSecondary}
              </Link>
            </div>
            <dl className="mt-10 flex gap-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-pixel text-2xl text-fg">{s.value}</dd>
                  <dd className="text-xs text-fg-3">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroTerminal />
        </div>
        <HeroLandscape />
      </section>

      {/* Platforms */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading label={h.platformsLabel} title={h.platformsTitle} />
        <div className="grid gap-5 md:grid-cols-2">
          {PLATFORMS.map((p, i) => {
            const isNms = p.id === 'paper-nms';
            return (
              <div key={p.id} data-reveal style={revealDelay(i)}>
              <div className={`card card-hover relative overflow-hidden p-6 ${isNms ? 'border-t-4 border-t-nms' : 'border-t-4 border-t-api'}`}>
                <div className="flex items-center gap-4">
                  <span className="mc-slot h-14 w-14">
                    <PixelIcon name={p.icon} className="h-8 w-8" />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-semibold text-fg">{p.label}</h3>
                    <p className={`font-pixel text-[12px] ${isNms ? 'text-nms' : 'text-api'}`}>{format(h.platformSkills, { count: countFor(p.id) })}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-fg-2">{isNms ? h.platformNmsDesc : h.platformApiDesc}</p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  <Link href={ROUTES.skillsFiltered({ platform: p.id })} className="font-medium text-accent hover:underline">
                    {h.ctaSecondary} →
                  </Link>
                  <Link href={`/docs/platforms/${p.docSlug}`} className="text-fg-2 hover:text-accent">
                    {h.platformSetup} →
                  </Link>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading label={h.stepsLabel} title={h.stepsTitle} />
          <ol className="grid gap-8 md:grid-cols-3">
            {h.steps.map((step, i) => (
              <li key={i} data-reveal style={revealDelay(i)} className="flex gap-4">
                <span className="mc-slot h-12 w-12">
                  <PixelIcon name={STEP_ICONS[i] ?? 'grass'} className="h-8 w-8" />
                </span>
                <div>
                  <p className="font-pixel text-[12px] text-accent">0{i + 1}</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-fg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionHeading
          label={h.featuredLabel}
          title={h.featuredTitle}
          action={
            <Link href={ROUTES.skills} className="text-sm font-medium text-accent hover:underline">
              {h.viewAll} →
            </Link>
          }
        />
        <SkillGrid skills={featuredSkills.slice(0, FEATURED_LIMIT)} reveal />
      </section>

      {/* Reference */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
        <SectionHeading label={h.referenceLabel} title={h.referenceTitle} />
        <p data-reveal className="-mt-4 mb-8 max-w-2xl text-sm text-fg-2">{h.referenceSubtitle}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {referenceDocs.map((d, i) => (
            <div key={d.href} data-reveal style={revealDelay(i)}>
            <Link href={d.href} className="card flex h-full items-center gap-3 p-4">
              <span className="mc-slot h-10 w-10">
                <PixelIcon name={d.icon} className="h-8 w-8" />
              </span>
              <span className="text-sm font-medium text-fg">{lang === 'en' ? d.title.en : d.title.zh}</span>
            </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Contribute */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div data-reveal className="flex flex-col items-start gap-6 rounded-md border border-line bg-surface p-8 sm:flex-row sm:items-center">
          <PixelIcon name="creeper" className="h-16 w-16 shrink-0" />
          <div className="flex-1">
            <h2 className="font-display text-2xl font-semibold text-fg">{h.ctaTitle}</h2>
            <p className="mt-1 text-sm text-fg-2">{h.ctaDescription}</p>
          </div>
          <a href={GITHUB_CONTRIBUTE_URLS[lang]} target="_blank" rel="noopener noreferrer" className="btn-pixel btn-primary">
            {h.ctaButton} ↗
          </a>
        </div>
      </section>
    </div>
  );
}
