'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useLanguage } from '@/shared/i18n';

const INSTALL = 'cp -r MJP-Paper-Skills/.claude/skills .agents/skills';
const FILES = ['ClientBorderService.java', 'BorderCommand.java', 'paper-plugin.yml'];
/** Seconds between lines of the one-shot typing animation (see .type-line in motion.css). */
const LINE_STEP = 0.32;

interface Line {
  key: string;
  content: ReactNode;
}

export function HeroTerminal() {
  const { t } = useLanguage();
  const h = t.home;

  const lines: Line[] = [
    { key: 'c1', content: <span className="text-fg-3">{h.terminalComment}</span> },
    { key: 'install', content: <><span className="text-accent">$</span> {INSTALL}</> },
    { key: 'gap1', content: null },
    { key: 'c2', content: <span className="text-fg-3">{h.terminalComment2}</span> },
    { key: 'prompt', content: <><span className="text-accent">&gt;</span> <span className="text-fg">{h.terminalPrompt}</span></> },
    { key: 'gap2', content: null },
    { key: 'result', content: <><span className="text-api">●</span> {h.terminalResult}</> },
    ...FILES.map((f) => ({ key: f, content: <>{'  '}<span className="text-api">+</span> {f}</> })),
    { key: 'gap3', content: null },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-line-strong bg-code-bg shadow-[0_6px_0_var(--color-line-strong)]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="h-2.5 w-2.5 bg-nms" />
        <span className="h-2.5 w-2.5 bg-celestial" />
        <span className="h-2.5 w-2.5 bg-api" />
        <span className="ml-2 truncate font-mono text-xs text-fg-3">{h.terminalTitle}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-fg-2">
        <code>
          {lines.map((line, i) => (
            <span key={line.key} className="type-line" style={{ '--line-delay': `${i * LINE_STEP}s` } as CSSProperties}>
              {line.content ?? ' '}
            </span>
          ))}
          <span className="type-line" style={{ '--line-delay': `${lines.length * LINE_STEP}s` } as CSSProperties}>
            <span className="text-accent">&gt;</span> <span className="cursor-blink inline-block h-4 w-2 translate-y-0.5 bg-accent" />
          </span>
        </code>
      </pre>
    </div>
  );
}
