'use server';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

/** Marca a lição como feita no servidor. Falhar aqui não pode travar a lição: só não salva. */
export async function markLessonDone(lessonId: string) {
  try {
    await api(`/progress/${encodeURIComponent(lessonId)}`, { method: 'POST' });
    revalidatePath('/aprender');
    revalidatePath('/aprender/trilha');
    revalidatePath('/perfil');
  } catch { /* segue sem salvar */ }
}

/** Uma vez só: sobe o que ficou salvo no navegador (versão antiga do protótipo) pro servidor. */
export async function importLocalProgress(ids: string[]) {
  for (const id of ids.filter((x) => /^m\d+-l\d+$/.test(x)).slice(0, 100)) await markLessonDone(id);
}
