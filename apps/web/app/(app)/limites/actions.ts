'use server';
import { revalidatePath } from 'next/cache';
import { setBudgetBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';

export type BudgetState = { error?: string; ok?: string };

export async function saveBudget(_: BudgetState, form: FormData): Promise<BudgetState> {
  const categoryId = String(form.get('categoryId'));
  const raw = String(form.get('limit') ?? '').trim();
  const cents = raw === '' ? null : parseMoney(raw);
  if (raw !== '' && cents === null) return { error: 'Não entendi esse valor.' };
  const parsed = setBudgetBody.safeParse({ limitInCents: cents === 0 ? null : cents });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api(`/budgets/${encodeURIComponent(categoryId)}`, { method: 'PUT', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  return { ok: parsed.data.limitInCents === null ? 'Limite tirado.' : 'Salvo.' };
}
