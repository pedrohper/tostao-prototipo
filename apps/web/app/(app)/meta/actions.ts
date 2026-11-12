'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { goalBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';

export type GoalState = { error?: string; message?: string };

export async function saveGoal(_: GoalState, form: FormData): Promise<GoalState> {
  const deadline = String(form.get('deadline') ?? '');
  const parsed = goalBody.safeParse({
    kind: form.get('kind') || 'outro',
    label: String(form.get('label') ?? '').trim() || null,
    amountInCents: parseMoney(String(form.get('amount') ?? '')),
    deadline: /^\d{4}-\d{2}$/.test(deadline) ? deadline : null,
  });
  if (!parsed.success || !parsed.data.amountInCents) return { error: 'Diz quanto você quer juntar.' };
  try {
    await api('/goal', { method: 'PUT', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect('/meta');
}

export async function deposit(_: GoalState, form: FormData): Promise<GoalState> {
  const cents = parseMoney(String(form.get('amount') ?? ''));
  if (!cents) return { error: 'Quanto?' };
  const out = form.get('dir') === 'tirei';
  try {
    await api('/goal/deposits', { method: 'POST', body: { amountInCents: out ? -cents : cents } });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  return { message: out ? 'Anotado. Acontece, o importante é voltar a guardar.' : 'Boa! Mais um tostão na meta.' };
}

export async function deleteGoal() {
  try { await api('/goal', { method: 'PUT', body: null }); } catch { /* fica como estava */ }
  revalidatePath('/', 'layout');
  redirect('/meta');
}
