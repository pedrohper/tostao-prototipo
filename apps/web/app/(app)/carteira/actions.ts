'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { categorizeBody, manualTransactionBody, type AutoCategorizeResponse } from '@tostao/contracts';
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
    accountId: form.get('accountId') || null,
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

/** Ocultar (ou mostrar de novo) uma conta, ex.: a poupança parada. Continua sincronizando, só some da tela e do saldo. */
export async function setAccountHidden(form: FormData) {
  const id = String(form.get('accountId') ?? '');
  if (!id) return;
  try {
    await api(`/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: { hidden: form.get('hidden') === 'true' } });
  } catch { /* se falhar, a conta só continua onde estava */ }
  revalidatePath('/', 'layout');
}

export type AutoState = { message?: string };

/** "Deixa o Tostão categorizar": a IA tenta as pendentes. Nome de pessoa e o que ela não souber continua pendente. */
export async function autoCategorize(_: AutoState): Promise<AutoState> {
  try {
    const r = await api<AutoCategorizeResponse>('/transactions/auto-categorize', { method: 'POST', body: {} });
    revalidatePath('/', 'layout');
    if (r.asked === 0) return { message: 'Meu cérebro de IA tá desligado agora. Bora no manual.' };
    if (r.categorized === 0) return { message: 'Não reconheci nenhuma dessas. Deve ser Pix pra pessoa, essas só você sabe.' };
    const rest = r.asked - r.categorized;
    return { message: `Categorizei ${r.categorized}. ${rest > 0 ? `${rest === 1 ? 'Sobrou 1' : `Sobraram ${rest}`} que só você sabe (Pix pra pessoa e afins).` : 'Confere se ficou certo.'}` };
  } catch {
    return { message: 'Não consegui agora. Tenta de novo daqui a pouco.' };
  }
}
