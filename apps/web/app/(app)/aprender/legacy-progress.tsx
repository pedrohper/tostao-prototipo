'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { takeLegacyDone } from '@/lib/progress';
import { importLocalProgress } from './actions';

/** Quem fez lição na versão antiga (progresso no navegador) não perde nada: sobe pro servidor uma vez. */
export function LegacyProgress({ saved }: { saved: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const legacy = takeLegacyDone().filter((id) => !saved.includes(id));
    if (legacy.length) void importLocalProgress(legacy).then(() => router.refresh());
  }, [saved, router]);
  return null;
}
