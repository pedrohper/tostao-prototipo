'use server';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export async function createInvite() {
  try {
    await api('/invites', { method: 'POST' });
  } catch { /* limite de convites abertos: a lista mostra o que já tem */ }
  revalidatePath('/convites');
}
