import { notFound } from 'next/navigation';
import type { MissionsResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { findLesson, modules } from '@/lib/lessons';
import { getBookPageAssets, getSlideAsset } from '@/lib/art-assets';
import { getStoryPageMeta } from '@/lib/story-cast';
import { LessonPlayer } from './player';

export function generateStaticParams() {
  return modules.flatMap((m) => m.lessons.map((l) => ({ licao: l.id })));
}

export default async function LicaoPage({ params }: { params: Promise<{ licao: string }> }) {
  const [{ licao }, { locale }, missions] = await Promise.all([
    params,
    getI18n(),
    api<MissionsResponse>('/missions').catch(() => null),
  ]);
  const found = findLesson(licao);
  if (!found) notFound();
  const all = modules.flatMap((m) => m.lessons);
  const next = all[all.findIndex((l) => l.id === licao) + 1] ?? null;
  const pageAsset = getBookPageAssets([licao])[licao] ?? null;
  const slideAsset = getSlideAsset(getStoryPageMeta(licao).slideKey);
  return (
    <LessonPlayer
      lesson={found.lesson}
      moduleTitle={found.module.title}
      moduleNumber={found.module.number}
      nextId={next?.id ?? null}
      pageAsset={pageAsset}
      slideAsset={slideAsset}
      locale={locale}
      initialMissions={missions}
      today={todayIso()}
    />
  );
}
