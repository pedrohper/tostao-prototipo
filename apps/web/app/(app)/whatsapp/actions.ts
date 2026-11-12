'use server';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type CodeState = { code?: string; number?: string | null; error?: string };

export async function createCode(_: CodeState): Promise<CodeState> {
  try {
    const r = await api<{ code: string; number: string | null }>('/whatsapp/code', { method: 'POST', body: {} });
    return { code: r.code, number: r.number };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export async function unlink() {
  try { await api('/whatsapp', { method: 'DELETE' }); } catch { /* fica como estava */ }
  revalidatePath('/whatsapp');
}
