'use server';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export async function createInvite() {
  try {
    await api('/invites', { method: 'POST' });
  } catch (caught) {
    rethrowIfRedirect(caught);
    /* limite de convites abertos: a lista mostra o que já tem */
  }
  revalidatePath('/convites');
}
