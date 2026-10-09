import type { SkillMeta } from '@/shared/types/skill';
import { SkillCard } from './SkillCard';
import { revealDelay } from '@/shared/motion/reveal';

interface SkillGridProps {
  skills: SkillMeta[];
  /** Scroll-reveal the cards (static lists only; filtered lists would re-hide on every change). */
  reveal?: boolean;
}

export function SkillGrid({ skills, reveal = false }: SkillGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill, i) =>
        reveal ? (
          <div key={skill.slug} data-reveal style={revealDelay(i)}>
            <SkillCard skill={skill} />
          </div>
        ) : (
          <SkillCard key={skill.slug} skill={skill} />
        ),
      )}
    </div>
  );
}
