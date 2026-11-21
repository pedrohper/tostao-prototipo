'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  categorizeBody,
  createManualAccountBody,
  manualTransactionBody,
  updateTransactionBody,
  type AutoCategorizeResponse,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { parseMoney } from '@/lib/format';
import { isSafePathSegment, safeInternalPath, safePathSegment } from '@/lib/safe-redirect';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type ActionState = { error?: string };

export async function categorize(_: ActionState, form: FormData): Promise<ActionState> {
  const id = safePathSegment(form.get('id'));
  const parsed = categorizeBody.safeParse({
    categoryId: form.get('categoryId') ?? '',
    remember: form.get('remember') === 'on',
  });
  if (!parsed.success) return { error: 'Escolhe uma categoria.' };
  try {
    await api(`/transactions/${id}/category`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect(safeInternalPath(form.get('back'), '/carteira'));
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
    repeat: form.get('repeat') || 'nao',
    times: form.get('repeat') === 'parcelado' ? Number(form.get('times') || 0) : undefined,
    note: String(form.get('note') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/transactions', { method: 'POST', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  // Veio de outra tela (ex.: Anotações)? Volta pra ela. Senão, mostra o mês na Carteira.
  const back = safeInternalPath(form.get('back'), '/carteira');
  if (back !== '/carteira') redirect(back);
  redirect(`/carteira?mes=${parsed.data.occurredAt.slice(0, 7)}`);
}

/** Ocultar (ou mostrar de novo) uma conta, ex.: a poupança parada. Continua sincronizando, só some da tela e do saldo. */
export async function setAccountHidden(form: FormData) {
  const id = form.get('accountId');
  if (!isSafePathSegment(id)) return;
  try {
    await api(`/accounts/${safePathSegment(id)}`, {
      method: 'PATCH',
      body: { hidden: form.get('hidden') === 'true' },
    });
  } catch (caught) {
    rethrowIfRedirect(caught);
    /* se falhar, a conta só continua onde estava */
  }
  revalidatePath('/', 'layout');
}

export type AutoState = { message?: string; needsConsent?: boolean };

/** "Deixa o Tostão categorizar": a IA tenta as pendentes. Nome de pessoa e o que ela não souber continua pendente. */
export async function autoCategorize(_: AutoState): Promise<AutoState> {
  try {
    const r = await api<AutoCategorizeResponse>('/transactions/auto-categorize', { method: 'POST', body: {} });
    revalidatePath('/', 'layout');
    if (r.asked === 0) return { message: 'Meu cérebro de IA tá desligado agora. Bora no manual.' };
    if (r.categorized === 0)
      return { message: 'Não reconheci nenhuma dessas. Deve ser Pix pra pessoa, essas só você sabe.' };
    const rest = r.asked - r.categorized;
    return {
      message: `Categorizei ${r.categorized}. ${rest > 0 ? `${rest === 1 ? 'Sobrou 1' : `Sobraram ${rest}`} que só você sabe (Pix pra pessoa e afins).` : 'Confere se ficou certo.'}`,
    };
  } catch (e) {
    rethrowIfRedirect(e);
    // LGPD: sem o aceite do aviso de IA a API responde 403; o botão mostra o aviso em vez de um erro seco.
    if (e instanceof ApiError && e.code === 'AI_CONSENT_REQUIRED') return { needsConsent: true };
    if (e instanceof ApiError && e.status === 429) return { message: e.message };
    return { message: 'Não consegui agora. Tenta de novo daqui a pouco.' };
  }
}

/** Apaga um lançamento anotado à mão (com serie=1, também os próximos do "todo mês"/parcelado). */
export async function apagarLancamento(form: FormData) {
  const id = form.get('id');
  const serie = form.get('serie') === '1';
  const back = safeInternalPath(form.get('back'), '/carteira');
  if (isSafePathSegment(id)) {
    try {
      await api(`/transactions/${safePathSegment(id)}${serie ? '?serie=1' : ''}`, { method: 'DELETE' });
    } catch (caught) {
      rethrowIfRedirect(caught);
      /* se falhar, o lançamento continua lá */
    }
  }
  revalidatePath('/', 'layout');
  redirect(back);
}

export async function toggleInternalTransfer(form: FormData) {
  const id = form.get('id');
  const isInternalTransfer = form.get('isInternalTransfer') === 'true';
  const back = safeInternalPath(form.get('back'), '/carteira');
  if (isSafePathSegment(id)) {
    try {
      await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: { isInternalTransfer } });
    } catch (caught) {
      rethrowIfRedirect(caught);
      /* se falhar, mantém o estado atual */
    }
  }
  revalidatePath('/', 'layout');
  redirect(back);
}

export async function updateManualTransaction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = form.get('id');
  const back = safeInternalPath(form.get('back'), '/carteira');
  if (!isSafePathSegment(id)) return { error: 'Não encontrei esse lançamento.' };
  const cents = parseMoney(String(form.get('amount') ?? ''));
  const kind = String(form.get('kind') || 'saida');
  if (!cents || cents <= 0) return { error: 'Valor precisa ser maior que zero.' };
  const parsed = updateTransactionBody.safeParse({
    description: form.get('description'),
    amountInCents: kind === 'entrada' ? cents : -cents,
    occurredAt: form.get('occurredAt'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  redirect(back);
}

/** Salva (ou apaga, se vier vazia) a anotação de qualquer lançamento, inclusive os que vieram do banco. */
export async function saveTransactionNote(form: FormData) {
  const id = form.get('id');
  const safeBack = safeInternalPath(form.get('back'), '/carteira');
  const parsed = updateTransactionBody.safeParse({ note: String(form.get('note') ?? '') });
  let failed = !parsed.success;
  if (isSafePathSegment(id) && parsed.success) {
    try {
      await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: parsed.data });
    } catch (caught) {
      rethrowIfRedirect(caught);
      failed = true;
    }
  }
  revalidatePath('/', 'layout');
  // Se não salvou, volta pra mesma tela com o aviso em vez de fingir que deu certo.
  if (failed && isSafePathSegment(id))
    redirect(`/carteira/${safePathSegment(id)}?voltar=${encodeURIComponent(safeBack)}&erro=nota`);
  redirect(safeBack);
}

export async function createManualAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const cents = parseMoney(String(form.get('balance') ?? '')) ?? 0;
  const parsed = createManualAccountBody.safeParse({
    name: form.get('name'),
    type: form.get('type') === 'CREDIT' ? 'CREDIT' : 'BANK',
    balanceInCents: cents,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await api('/accounts', { method: 'POST', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidatePath('/', 'layout');
  return {};
}
