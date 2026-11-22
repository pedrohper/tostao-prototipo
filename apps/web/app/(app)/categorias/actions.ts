'use server';
import { revalidateFinance } from '@/lib/revalidate';
import { createCategoryBody, type CategoryDTO } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type CategoryState = { error?: string; ok?: string };

export async function createCategory(_: CategoryState, form: FormData): Promise<CategoryState> {
  const parsed = createCategoryBody.safeParse({
    name: form.get('name'),
    emoji: form.get('emoji') || undefined,
    kind: form.get('kind'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/categories', { method: 'POST', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidateFinance();
  return { ok: `${parsed.data.name} criada.` };
}

export type InlineCategoryResult = { category?: CategoryDTO; error?: string };

/**
 * "+ Criar categoria" dentro do seletor (Anotar, Categorizar, detalhe da Carteira). Não recebe FormData nem mexe em
 * `useActionState`: o seletor chama direto, então o formulário que está em volta (valor, data, descrição) não perde
 * nada. Devolve a categoria criada pra ele já selecionar.
 */
export async function createCategoryInline(input: {
  name: string;
  kind: 'saida' | 'entrada';
  color?: string;
  emoji?: string;
}): Promise<InlineCategoryResult> {
  const parsed = createCategoryBody.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const { category } = await api<{ category: CategoryDTO }>('/categories', { method: 'POST', body: parsed.data });
    revalidateFinance();
    return { category };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export async function deleteCategory(form: FormData) {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  try {
    await api(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (caught) {
    rethrowIfRedirect(caught);
    /* se falhar, ela só continua na lista */
  }
  revalidateFinance();
}
