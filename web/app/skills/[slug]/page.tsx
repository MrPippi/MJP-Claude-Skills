import type { Metadata } from 'next';
import { Redirect } from '@/shared/ui/Redirect';
import { getAllSkills } from '@/features/skills';
import { ROUTES } from '@/config/routes';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSkills().map((skill) => ({ slug: skill.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { robots: { index: false }, alternates: { canonical: ROUTES.skill(slug) } };
}

export default async function LegacySkillPage({ params }: Props) {
  const { slug } = await params;
  return <Redirect to={ROUTES.skill(slug)} />;
}
