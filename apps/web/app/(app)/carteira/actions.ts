'use server';
import { revalidateFinance } from '@/lib/revalidate';
import { redirect } from 'next/navigation';
import {
  categorizeBody,
  createManualAccountBody,
  manualTransactionBody,
  updateTransactionBody,
  type AutoCategorizeResponse,
  type CategoryDTO,
  type TransactionDTO,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { currentMonth, parseMoney, shiftMonth, todayIso } from '@/lib/format';
import { isSafePathSegment, safeInternalPath, safePathSegment } from '@/lib/safe-redirect';
import { rethrowIfRedirect } from '@/lib/rethrow';
import { flashToast } from '@/lib/flash-toast-server';
import { recentDescriptions } from '@/lib/quick-add';

export type ActionState = { error?: string; saved?: boolean };

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
  revalidateFinance();
  // "Desfazer" só quando havia categoria antes (a API não tem "tirar categoria"): volta pra anterior.
  const previous = String(form.get('previousCategoryId') ?? '');
  await flashToast(
    'Categoria salva.',
    'success',
    previous && previous !== parsed.data.categoryId ? { kind: 'categorize', id, categoryId: previous } : undefined,
  );
  redirect(safeInternalPath(form.get('back'), '/carteira'));
}

/** Categoriza UMA transação sem redirecionar (modo "Categorizar pendentes": a pessoa segue pra próxima na mesma tela). */
export async function categorizeInline(id: string, categoryId: string, remember: boolean): Promise<ActionState> {
  if (!isSafePathSegment(id)) return { error: 'Não encontrei esse lançamento.' };
  const parsed = categorizeBody.safeParse({ categoryId, remember });
  if (!parsed.success) return { error: 'Escolhe uma categoria.' };
  try {
    await api(`/transactions/${safePathSegment(id)}/category`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidateFinance();
  return { saved: true };
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
  revalidateFinance();
  // "Salvar e anotar outro" / folha rápida: fica na tela (sem redirect) e quem chamou mostra o toast e limpa o formulário.
  const intent = form.get('intent');
  if (intent === 'another' || intent === 'stay') return { saved: true };
  await flashToast(parsed.data.kind === 'entrada' ? 'Entrada anotada.' : 'Gasto anotado.');
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
  revalidateFinance();
}

export type AutoState = { message?: string; needsConsent?: boolean };

/** "Deixa o Tostão categorizar": a IA tenta as pendentes. Nome de pessoa e o que ela não souber continua pendente. */
export async function autoCategorize(_: AutoState): Promise<AutoState> {
  try {
    const r = await api<AutoCategorizeResponse>('/transactions/auto-categorize', { method: 'POST', body: {} });
    revalidateFinance();
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
  let failed = !isSafePathSegment(id);
  if (isSafePathSegment(id)) {
    try {
      await api(`/transactions/${safePathSegment(id)}${serie ? '?serie=1' : ''}`, { method: 'DELETE' });
    } catch (caught) {
      rethrowIfRedirect(caught);
      failed = true; // o lançamento continua lá
    }
  }
  revalidateFinance();
  await (failed
    ? flashToast('Não consegui apagar agora. Tenta de novo?', 'error')
    : flashToast(serie ? 'Lançamentos apagados.' : 'Lançamento apagado.'));
  redirect(back);
}

/** Apelido do lançamento (vale também pra transação do banco). Vazio volta pro nome original. */
export async function saveNickname(_: ActionState, form: FormData): Promise<ActionState> {
  const id = form.get('id');
  if (!isSafePathSegment(id)) return { error: 'Não encontrei esse lançamento.' };
  const parsed = updateTransactionBody.safeParse({ customDescription: String(form.get('customDescription') ?? '') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Apelido inválido.' };
  try {
    await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
  revalidateFinance();
  return { saved: true };
}

export async function toggleInternalTransfer(form: FormData) {
  const id = form.get('id');
  const isInternalTransfer = form.get('isInternalTransfer') === 'true';
  const back = safeInternalPath(form.get('back'), '/carteira');
  let failed = !isSafePathSegment(id);
  if (isSafePathSegment(id)) {
    try {
      await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: { isInternalTransfer } });
    } catch (caught) {
      rethrowIfRedirect(caught);
      failed = true; // mantém o estado atual
    }
  }
  revalidateFinance();
  await (failed
    ? flashToast('Não consegui mudar agora. Tenta de novo?', 'error')
    : flashToast(
        isInternalTransfer ? 'Marcado como transferência: não conta como gasto.' : 'Voltou a contar como gasto.',
      ));
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
  revalidateFinance();
  await flashToast('Lançamento atualizado.');
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
  revalidateFinance();
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
  revalidateFinance();
  return {};
}

export type QuickAddData = {
  categories: CategoryDTO[];
  recents: string[];
  today: string;
};

/**
 * Dados da folha "Anotar rápido", pedidos só quando ela abre (não pesam o carregamento da Home nem da Carteira):
 * categorias e as últimas descrições que a pessoa usou (mês atual e o anterior).
 */
export async function loadQuickAddData(): Promise<{ data?: QuickAddData; error?: true }> {
  try {
    const month = currentMonth();
    const [{ categories }, now, before] = await Promise.all([
      api<{ categories: CategoryDTO[] }>('/categories'),
      api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
      api<{ transactions: TransactionDTO[] }>(`/transactions?month=${shiftMonth(month, -1)}`),
    ]);
    return {
      data: {
        categories: categories.filter((c) => c.kind !== 'neutra'),
        recents: recentDescriptions([...now.transactions, ...before.transactions]),
        today: todayIso(),
      },
    };
  } catch (caught) {
    rethrowIfRedirect(caught);
    return { error: true };
  }
}
