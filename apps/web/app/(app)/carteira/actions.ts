'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { categorizeBody, manualTransactionBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';

export type ActionState = { error?: string };

export async function categorize(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  const parsed = categorizeBody.safeParse({ categoryId: form.get('categoryId') ?? '', remember: form.get('remember') === 'on' });
  if (!parsed.success) return { error: 'Escolhe uma categoria.' };
  try {
    await api(`/transactions/${id}/category`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect(String(form.get('back') || '/carteira'));
}

export async function createManual(_: ActionState, form: FormData): Promise<ActionState> {
  const cents = parseMoney(String(form.get('amount') ?? ''));
  const parsed = manualTransactionBody.safeParse({
    description: form.get('description'),
    amountInCents: cents ?? 0,
    kind: form.get('kind'),
    occurredAt: form.get('occurredAt'),
    categoryId: form.get('categoryId') || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/transactions', { method: 'POST', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect(`/carteira?mes=${parsed.data.occurredAt.slice(0, 7)}`);
}
