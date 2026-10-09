import type { SkillMeta } from '@/shared/types/skill';
import { SkillCard } from './SkillCard';

export function SkillGrid({ skills }: { skills: SkillMeta[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill) => (
        <SkillCard key={skill.slug} skill={skill} />
      ))}
    </div>
  );
}
