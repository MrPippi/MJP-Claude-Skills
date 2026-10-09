import type { Metadata } from 'next';
import { Redirect } from '@/shared/ui/Redirect';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = { robots: { index: false }, alternates: { canonical: ROUTES.skills } };

export default function LegacySkillsPage() {
  return <Redirect to={ROUTES.skills} />;
}
