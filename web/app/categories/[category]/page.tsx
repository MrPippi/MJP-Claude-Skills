import type { Metadata } from 'next';
import { Redirect } from '@/shared/ui/Redirect';
import { getCategories } from '@/features/skills';
import { ROUTES } from '@/config/routes';

interface Props {
  params: Promise<{ category: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getCategories().map((c) => ({ category: c.id }));
}

export const metadata: Metadata = { robots: { index: false }, alternates: { canonical: ROUTES.skills } };

export default async function LegacyCategoryPage({ params }: Props) {
  const { category } = await params;
  return <Redirect to={ROUTES.skillsFiltered({ category })} />;
}
