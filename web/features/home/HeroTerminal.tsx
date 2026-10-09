'use client';

import { useLanguage } from '@/shared/i18n';

const INSTALL = 'cp -r MJP-Claude-Skills/.claude/skills .claude/skills';
const FILES = ['ClientBorderService.java', 'BorderCommand.java', 'paper-plugin.yml'];

export function HeroTerminal() {
  const { t } = useLanguage();
  const h = t.home;

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
          <span className="text-fg-3">{h.terminalComment}</span>
          {'\n'}
          <span className="text-accent">$</span> {INSTALL}
          {'\n\n'}
          <span className="text-fg-3">{h.terminalComment2}</span>
          {'\n'}
          <span className="text-accent">&gt;</span> <span className="text-fg">{h.terminalPrompt}</span>
          {'\n\n'}
          <span className="text-api">●</span> {h.terminalResult}
          {FILES.map((f) => (
            <span key={f}>
              {'\n  '}
              <span className="text-api">+</span> {f}
            </span>
          ))}
          {'\n\n'}
          <span className="text-accent">&gt;</span> <span className="cursor-blink inline-block h-4 w-2 translate-y-0.5 bg-accent" />
        </code>
      </pre>
    </div>
  );
}
