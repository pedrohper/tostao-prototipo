'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { goalBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney, resolveBackHref } from '@/lib/format';

export type GoalState = { error?: string; message?: string };

export async function saveGoal(_: GoalState, form: FormData): Promise<GoalState> {
  const deadline = String(form.get('deadline') ?? '');
  const id = String(form.get('id') ?? '').trim();
  const voltarRaw = String(form.get('voltar') ?? '').trim();
  const parsed = goalBody.safeParse({
    ...(id ? { id } : {}),
    kind: form.get('kind') || 'outro',
    label: String(form.get('label') ?? '').trim() || null,
    amountInCents: parseMoney(String(form.get('amount') ?? '')),
    deadline: /^\d{4}-\d{2}$/.test(deadline) ? deadline : null,
  });
  if (!parsed.success || !parsed.data.amountInCents) return { error: 'Diz quanto você quer juntar.' };

  let targetId = id;
  try {
    if (id) {
      await api(`/goals/${encodeURIComponent(id)}`, { method: 'PUT', body: parsed.data });
    } else {
      const res = await api<{ goal: { id?: string } }>('/goals', { method: 'POST', body: parsed.data });
      targetId = res.goal?.id ?? '';
    }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  const qs = new URLSearchParams();
  if (targetId) qs.set('id', targetId);
  if (voltarRaw) qs.set('voltar', resolveBackHref(voltarRaw, '/carteira?aba=planejar'));
  const query = qs.toString();
  redirect(query ? `/meta?${query}` : '/meta');
}

export async function deposit(_: GoalState, form: FormData): Promise<GoalState> {
  const cents = parseMoney(String(form.get('amount') ?? ''));
  if (!cents) return { error: 'Quanto?' };
  const out = form.get('dir') === 'tirei';
  const goalId = String(form.get('goalId') ?? '').trim() || undefined;
  try {
    await api('/goal/deposits', { method: 'POST', body: { goalId, amountInCents: out ? -cents : cents } });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  return { message: out ? 'Anotado. Acontece, o importante é voltar a guardar.' : 'Boa! Mais um tostão na meta.' };
}

export async function deleteGoal(form: FormData) {
  const id = String(form.get('id') ?? '').trim();
  const voltarRaw = String(form.get('voltar') ?? '').trim();
  try {
    if (id) {
      await api(`/goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } else {
      await api('/goal', { method: 'PUT', body: null });
    }
  } catch {
    /* fica como estava */
  }
  revalidatePath('/', 'layout');
  const qs = new URLSearchParams();
  if (voltarRaw) qs.set('voltar', resolveBackHref(voltarRaw, '/carteira?aba=planejar'));
  const query = qs.toString();
  redirect(query ? `/meta?${query}` : '/meta');
}
