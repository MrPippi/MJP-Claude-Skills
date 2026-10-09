import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllSkills, getSkillBySlug, SkillDetail } from '@/features/skills';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);
  if (!skill) return { title: 'Skill Not Found' };
  return {
    title: skill.titleZh,
    description: skill.descriptionZh,
    openGraph: { title: `${skill.titleZh} | MJP-Claude-Skills`, description: skill.descriptionZh },
  };
}

export default async function SkillPage({ params }: Props) {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);
  if (!skill) notFound();
  return <SkillDetail skill={skill} />;
}
