'use server';
import { revalidatePath } from 'next/cache';
import { createCategoryBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type CategoryState = { error?: string; ok?: string };

export async function createCategory(_: CategoryState, form: FormData): Promise<CategoryState> {
  const parsed = createCategoryBody.safeParse({ name: form.get('name'), emoji: form.get('emoji') || undefined, kind: form.get('kind') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/categories', { method: 'POST', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  return { ok: `${parsed.data.name} criada.` };
}

export async function deleteCategory(form: FormData) {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try {
    await api(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch { /* se falhar, ela só continua na lista */ }
  revalidatePath('/', 'layout');
}
