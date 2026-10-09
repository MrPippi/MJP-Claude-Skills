import { getAllSkills, getFeaturedSkills } from '@/features/skills';
import { getDocLinks } from '@/features/docs';
import { HomePageClient } from '@/features/home/HomePageClient';

export default function HomePage() {
  return (
    <HomePageClient
      skills={getAllSkills()}
      featuredSkills={getFeaturedSkills()}
      referenceDocs={getDocLinks().filter((d) => d.section === 'reference')}
    />
  );
}
