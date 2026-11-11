import { notFound } from 'next/navigation';
import { findLesson, modules } from '@/lib/lessons';
import { LessonPlayer } from './player';

export function generateStaticParams() {
  return modules.flatMap((m) => m.lessons.map((l) => ({ licao: l.id })));
}

export default async function LicaoPage({ params }: { params: Promise<{ licao: string }> }) {
  const { licao } = await params;
  const found = findLesson(licao);
  if (!found) notFound();
  const all = modules.flatMap((m) => m.lessons);
  const next = all[all.findIndex((l) => l.id === licao) + 1] ?? null;
  return <LessonPlayer lesson={found.lesson} moduleTitle={found.module.title} moduleNumber={found.module.number} nextId={next?.id ?? null} />;
}
