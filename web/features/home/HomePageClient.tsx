'use client';

import Link from 'next/link';
import type { SkillMeta } from '@/shared/types/skill';
import type { DocLink } from '@/features/docs/registry';
import { SkillGrid } from '@/features/skills/components/SkillGrid';
import { getPlatform, PLATFORMS } from '@/features/skills/lib/platform';
import { HeroScene } from './HeroScene';
import { HeroTerminal } from './HeroTerminal';
import { ROUTES } from '@/config/routes';
import { GITHUB_CONTRIBUTE_URL } from '@/config/site';
import { PixelIcon } from '@/shared/ui/PixelIcon';
import type { PixelIconName } from '@/shared/ui/pixel-icons';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { format, useLanguage } from '@/shared/i18n';

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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{label}</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-fg">{title}</h2>
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
        <HeroScene />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-48 pt-16 sm:px-6 sm:pb-60 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-[3px] border border-line-strong bg-bg/70 px-2 py-1 font-pixel text-[10px] uppercase text-fg-2">
              <span className="h-1.5 w-1.5 bg-api" />
              {skills.length} skills · {MC_VERSIONS.join(' · ')}
            </p>
            <h1 className="mt-6 font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl lg:text-6xl">
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
      </section>

      {/* Platforms */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading label={h.platformsLabel} title={h.platformsTitle} />
        <div className="grid gap-5 md:grid-cols-2">
          {PLATFORMS.map((p) => {
            const isNms = p.id === 'paper-nms';
            return (
              <div key={p.id} className={`card card-hover relative overflow-hidden p-6 ${isNms ? 'border-t-4 border-t-nms' : 'border-t-4 border-t-api'}`}>
                <div className="flex items-center gap-4">
                  <span className="grid h-14 w-14 place-items-center rounded-[3px] border border-line bg-surface">
                    <PixelIcon name={p.icon} className="h-9 w-9" />
                  </span>
                  <div>
                    <h3 className="font-serif text-2xl font-semibold text-fg">{p.label}</h3>
                    <p className={`font-pixel text-[11px] ${isNms ? 'text-nms' : 'text-api'}`}>{format(h.platformSkills, { count: countFor(p.id) })}</p>
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
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading label={h.stepsLabel} title={h.stepsTitle} />
          <ol className="grid gap-8 md:grid-cols-3">
            {h.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[3px] border border-line-strong bg-bg shadow-[0_3px_0_var(--color-line-strong)]">
                  <PixelIcon name={STEP_ICONS[i] ?? 'grass'} className="h-7 w-7" />
                </span>
                <div>
                  <p className="font-pixel text-[11px] text-accent">0{i + 1}</p>
                  <h3 className="mt-1 font-serif text-xl font-semibold text-fg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading
          label={h.featuredLabel}
          title={h.featuredTitle}
          action={
            <Link href={ROUTES.skills} className="text-sm font-medium text-accent hover:underline">
              {h.viewAll} →
            </Link>
          }
        />
        <SkillGrid skills={featuredSkills.slice(0, FEATURED_LIMIT)} />
      </section>

      {/* Reference */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <SectionHeading label={h.referenceLabel} title={h.referenceTitle} />
        <p className="-mt-4 mb-8 max-w-2xl text-sm text-fg-2">{h.referenceSubtitle}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {referenceDocs.map((d) => (
            <Link key={d.href} href={d.href} className="card flex items-center gap-3 p-4">
              <PixelIcon name={d.icon} className="h-7 w-7 shrink-0" />
              <span className="text-sm font-medium text-fg">{lang === 'en' ? d.title.en : d.title.zh}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Contribute */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-md border border-line bg-surface p-8 sm:flex-row sm:items-center">
          <PixelIcon name="creeper" className="h-14 w-14 shrink-0" />
          <div className="flex-1">
            <h2 className="font-serif text-2xl font-semibold text-fg">{h.ctaTitle}</h2>
            <p className="mt-1 text-sm text-fg-2">{h.ctaDescription}</p>
          </div>
          <a href={GITHUB_CONTRIBUTE_URL} target="_blank" rel="noopener noreferrer" className="btn-pixel btn-primary">
            {h.ctaButton} ↗
          </a>
        </div>
      </section>
    </div>
  );
}
