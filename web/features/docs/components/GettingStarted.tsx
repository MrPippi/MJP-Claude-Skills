'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { DocArticle } from './DocArticle';
import { ROUTES } from '@/config/routes';
import { GITHUB_REPO_URL } from '@/config/site';
import { useCopyButtons } from '@/shared/ui/CopyCodeEnhancer';
import { useLanguage } from '@/shared/i18n';

const STEPS_ID = 'steps';
const FAQ_ID = 'faq';

export function GettingStarted() {
  const { t, lang } = useLanguage();
  const g = t.gettingStarted;
  const ref = useRef<HTMLDivElement>(null);
  useCopyButtons(ref, [lang]);

  const headings = [
    { id: STEPS_ID, text: g.stepsTitle, level: 2 as const },
    ...g.steps.map((s) => ({ id: `step-${s.number}`, text: s.title, level: 3 as const })),
    { id: FAQ_ID, text: g.faqTitle, level: 2 as const },
  ];

  return (
    <DocArticle eyebrow={g.label} title={g.title} icon="grass" description={g.description} headings={headings}>
      <div ref={ref} className="doc-prose">
        <h2 id={STEPS_ID}>{g.stepsTitle}</h2>
        <ol className="!list-none !pl-0 space-y-8">
          {g.steps.map((step) => (
            <li key={step.number} className="relative pl-14">
              <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-[3px] bg-accent font-pixel text-sm text-accent-ink shadow-[0_3px_0_var(--color-accent-deep)]">
                {step.number}
              </span>
              <h3 id={`step-${step.number}`} className="!mt-0">{step.title}</h3>
              <p>{step.description}</p>
              {step.code && (
                <pre data-lang="bash" className="mt-3">
                  <code>{step.code}</code>
                </pre>
              )}
              {step.triggers && (
                <ul className="!list-none !pl-0 mt-3 grid gap-2 sm:grid-cols-2">
                  {step.triggers.map((tr) => (
                    <li key={tr.skill} className="!mt-0 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                      <span className="block text-fg">{tr.keyword}</span>
                      <Link href={ROUTES.skill(tr.skill)} className="font-mono text-xs !no-underline">
                        → {tr.skill}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {step.outputs && (
                <ul className="mt-3">
                  {step.outputs.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              )}
              <blockquote className="mt-3 text-sm">{step.note}</blockquote>
            </li>
          ))}
        </ol>

        <h2 id={FAQ_ID}>{g.faqTitle}</h2>
        <p className="text-sm">
          {g.faqSubtitle}{' '}
          <a href={`${GITHUB_REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
            GitHub Issues ↗
          </a>
        </p>
        <div className="space-y-2">
          {g.faqs.map((faq) => (
            <details key={faq.q} className="group rounded-md border border-line bg-surface px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg">
                {faq.q}
                <span className="font-pixel text-xs text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm">{faq.a}</p>
            </details>
          ))}
        </div>

        <div className="!mt-12 rounded-md border border-line bg-surface p-6 text-center">
          <h2 className="!m-0 !border-0 !p-0">{g.ctaTitle}</h2>
          <p className="text-sm">{g.ctaDescription}</p>
          <Link href={ROUTES.skills} className="btn-pixel btn-primary mt-4 !no-underline">
            {g.ctaButton} →
          </Link>
        </div>
      </div>
    </DocArticle>
  );
}
