'use server';
import type { MissionsResponse } from '@tostao/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { orFallback, rethrowIfRedirect } from '@/lib/rethrow';

/** Marca a lição como feita no servidor e retorna ofensiva + semana atualizadas. */
export async function markLessonDone(lessonId: string): Promise<MissionsResponse | null> {
  try {
    await api(`/progress/${encodeURIComponent(lessonId)}`, { method: 'POST' });
    const missions = await api<MissionsResponse>('/missions').catch(orFallback(null));
    revalidatePath('/aprender');
    revalidatePath('/aprender/trilha');
    revalidatePath('/mais');
    revalidatePath('/perfil');
    revalidatePath('/tostao');
    revalidatePath('/inicio');
    revalidatePath('/ofensiva');
    return missions;
  } catch (caught) {
    rethrowIfRedirect(caught);
    return null;
  }
}

/** Uma vez só: sobe o que ficou salvo no navegador (versão antiga do app) pro servidor. */
export async function importLocalProgress(ids: string[]) {
  for (const id of ids.filter((x) => /^m\d+-l\d+$/.test(x)).slice(0, 100)) await markLessonDone(id);
}
