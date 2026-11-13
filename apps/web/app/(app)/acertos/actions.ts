'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createPersonBody, linkPersonBody, personEntryBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';

const safeBack = (v: FormDataEntryValue | null, fallback: string) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : fallback);
const comErro = (url: string, msg: string) => `${url}${url.includes('?') ? '&' : '?'}erro=${encodeURIComponent(msg)}`;

/** "Essa compra não é minha" / "foi empréstimo": liga o lançamento a alguém. */
export async function ligarPessoa(form: FormData) {
  const id = String(form.get('id') ?? '');
  const back = safeBack(form.get('back'), '/carteira');
  const parsed = linkPersonBody.safeParse({ personName: form.get('personName') === null ? null : String(form.get('personName')) });
  if (!parsed.success) redirect(comErro(`/carteira/${id}?voltar=${encodeURIComponent(back)}`, parsed.error.issues[0]?.message ?? 'Diz o nome'));
  try {
    await api(`/transactions/${encodeURIComponent(id)}/person`, { method: 'PUT', body: parsed.data });
  } catch (e) {
    redirect(comErro(`/carteira/${id}?voltar=${encodeURIComponent(back)}`, e instanceof ApiError ? e.message : 'Algo deu errado.'));
  }
  revalidatePath('/', 'layout');
  redirect(back);
}

export async function desligarPessoa(form: FormData) {
  const id = String(form.get('id') ?? '');
  try { await api(`/transactions/${encodeURIComponent(id)}/person`, { method: 'PUT', body: { personName: null } }); } catch { /* fica como estava */ }
  revalidatePath('/', 'layout');
  redirect(safeBack(form.get('back'), '/carteira'));
}

/** Acerto anotado à mão. Com `personName` (tela geral) acha/cria a pessoa antes. */
export async function anotarAcerto(form: FormData) {
  let personId = String(form.get('personId') ?? '');
  const volta = personId ? `/acertos/${personId}` : '/acertos';
  const body = personEntryBody.safeParse({
    kind: form.get('kind'),
    amountInCents: parseMoney(String(form.get('amount') ?? '')) ?? 0,
    description: String(form.get('description') ?? '') || undefined,
    occurredAt: form.get('occurredAt'),
  });
  if (!body.success) redirect(comErro(volta, body.error.issues[0]?.message ?? 'Confere os campos'));
  try {
    if (!personId) {
      const name = createPersonBody.safeParse({ name: form.get('personName') });
      if (!name.success) redirect(comErro(volta, name.error.issues[0]?.message ?? 'Diz o nome'));
      personId = (await api<{ id: string }>('/people', { method: 'POST', body: name.data })).id;
    }
    await api(`/people/${encodeURIComponent(personId)}/entries`, { method: 'POST', body: body.data });
  } catch (e) {
    if (e instanceof ApiError) redirect(comErro(volta, e.message));
    throw e;
  }
  revalidatePath('/', 'layout');
  redirect(`/acertos/${personId}`);
}

export async function apagarPessoa(form: FormData) {
  const id = String(form.get('personId') ?? '');
  try { await api(`/people/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* nada */ }
  revalidatePath('/', 'layout');
  redirect('/acertos');
}
