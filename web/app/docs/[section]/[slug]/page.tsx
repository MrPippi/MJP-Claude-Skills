import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DOC_SECTIONS, DOC_SOURCES, getDocPage, type DocSection } from '@/features/docs';
import { DocPageClient } from '@/features/docs/components/DocPageClient';

interface Props {
  params: Promise<{ section: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SOURCES.map(({ section, slug }) => ({ section, slug }));
}

function isSection(value: string): value is DocSection {
  return (DOC_SECTIONS as readonly string[]).includes(value);
}

async function load(params: Props['params']) {
  const { section, slug } = await params;
  return isSection(section) ? getDocPage(section, slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(params);
  if (!page) return { title: 'Not found' };
  return { title: `${page.title.zh} ${page.title.en}`, description: `${page.title.zh} — ${page.title.en}` };
}

export default async function DocRoute({ params }: Props) {
  const page = await load(params);
  if (!page) notFound();
  return <DocPageClient page={page} />;
}
