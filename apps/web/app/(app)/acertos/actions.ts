'use server';
import { revalidateFinance } from '@/lib/revalidate';
import { redirect } from 'next/navigation';
import { createPersonBody, linkPersonBody, personEntryBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';
import { comErro, type ErroCodigo } from '@/lib/erros';
import { isSafePathSegment, safeInternalPath, safePathSegment } from '@/lib/safe-redirect';
import { rethrowIfRedirect } from '@/lib/rethrow';

/** Mensagem do Zod (texto fixo do contrato) -> código de erro da URL. */
const codigoDe = (issue: { path: PropertyKey[] } | undefined): ErroCodigo =>
  issue?.path[0] === 'name' || issue?.path[0] === 'personName' ? 'nome_invalido' : 'dados_invalidos';

/** "Essa compra não é minha" / "foi empréstimo": liga o lançamento a alguém. */
export async function ligarPessoa(form: FormData) {
  const rawId = form.get('id');
  const back = safeInternalPath(form.get('back'), '/carteira');
  if (!isSafePathSegment(rawId)) redirect(comErro(back, 'nao_encontrado'));
  const id = safePathSegment(rawId);
  const voltar = `/carteira/${id}?voltar=${encodeURIComponent(back)}`;
  const parsed = linkPersonBody.safeParse({
    personName: form.get('personName') === null ? null : String(form.get('personName')),
  });
  if (!parsed.success) redirect(comErro(voltar, codigoDe(parsed.error.issues[0])));
  try {
    await api(`/transactions/${id}/person`, { method: 'PUT', body: parsed.data });
  } catch (caught) {
    rethrowIfRedirect(caught);
    redirect(comErro(voltar, 'falha_salvar'));
  }
  revalidateFinance();
  redirect(back);
}

export async function desligarPessoa(form: FormData) {
  const id = form.get('id');
  if (isSafePathSegment(id)) {
    try {
      await api(`/transactions/${safePathSegment(id)}/person`, { method: 'PUT', body: { personName: null } });
    } catch (caught) {
      rethrowIfRedirect(caught);
      /* fica como estava */
    }
  }
  revalidateFinance();
  redirect(safeInternalPath(form.get('back'), '/carteira'));
}

/** Acerto anotado à mão. Com `personName` (tela geral) acha/cria a pessoa antes. */
export async function anotarAcerto(form: FormData) {
  const rawPersonId = form.get('personId');
  const hasPerson = typeof rawPersonId === 'string' && rawPersonId !== '';
  if (hasPerson && !isSafePathSegment(rawPersonId)) redirect(comErro('/acertos', 'nao_encontrado'));
  let personId = hasPerson ? (rawPersonId as string) : '';
  const volta = personId ? `/acertos/${safePathSegment(personId)}` : '/acertos';
  const body = personEntryBody.safeParse({
    kind: form.get('kind'),
    amountInCents: parseMoney(String(form.get('amount') ?? '')) ?? 0,
    description: String(form.get('description') ?? '') || undefined,
    occurredAt: form.get('occurredAt'),
  });
  if (!body.success) redirect(comErro(volta, codigoDe(body.error.issues[0])));
  try {
    if (!personId) {
      const name = createPersonBody.safeParse({ name: form.get('personName') });
      if (!name.success) redirect(comErro(volta, 'nome_invalido'));
      personId = (await api<{ id: string }>('/people', { method: 'POST', body: name.data })).id;
    }
    await api(`/people/${safePathSegment(personId)}/entries`, { method: 'POST', body: body.data });
  } catch (e) {
    rethrowIfRedirect(e);
    if (e instanceof ApiError) redirect(comErro(volta, 'falha_salvar'));
    throw e;
  }
  revalidateFinance();
  redirect(`/acertos/${safePathSegment(personId)}`);
}

export async function apagarPessoa(form: FormData) {
  const id = form.get('personId');
  if (isSafePathSegment(id)) {
    try {
      await api(`/people/${safePathSegment(id)}`, { method: 'DELETE' });
    } catch (caught) {
      rethrowIfRedirect(caught);
      /* nada */
    }
  }
  revalidateFinance();
  redirect('/acertos');
}

/** Renomeia a pessoa/grupo ("Divido com minha família" → "Casa"). */
export async function renomearPessoa(form: FormData) {
  const rawId = form.get('personId');
  if (!isSafePathSegment(rawId)) redirect(comErro('/acertos', 'nao_encontrado'));
  const id = safePathSegment(rawId);
  const volta = `/acertos/${id}`;
  const parsed = createPersonBody.safeParse({ name: form.get('name') });
  if (!parsed.success) redirect(comErro(volta, 'nome_invalido'));
  try {
    await api(`/people/${id}`, { method: 'PATCH', body: parsed.data });
  } catch (caught) {
    rethrowIfRedirect(caught);
    redirect(comErro(volta, 'falha_salvar'));
  }
  revalidateFinance();
  redirect(volta);
}
