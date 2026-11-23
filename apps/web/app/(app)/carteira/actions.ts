'use server';
import { revalidateFinance } from '@/lib/revalidate';
import { redirect } from 'next/navigation';
import {
  categorizeBody,
  createManualAccountBody,
  linkPersonBody,
  manualTransactionBody,
  updateTransactionBody,
  type AutoCategorizeResponse,
  type CategoryDTO,
  type PeopleResponse,
  type PersonDTO,
  type TransactionDTO,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { getMe } from '@/lib/api-queries';
import type { ContaOption } from '@/app/(app)/anotar/anotar-form';
import { currentMonth, parseMoney, shiftMonth, todayIso } from '@/lib/format';
import { isSafePathSegment, safeInternalPath, safePathSegment } from '@/lib/safe-redirect';
import { orFallback, rethrowIfRedirect } from '@/lib/rethrow';
import { flashToast } from '@/lib/flash-toast-server';
import { recentDescriptions } from '@/lib/quick-add';
import { recurringBodyFrom } from '@/lib/recurring-form';
import {
  reconcileBalanceBody,
  transferLinkBody,
  type ReconcileBalanceResponse,
  type RecurringRulesResponse,
} from '@tostao/contracts';

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
    settled: form.has('settled') ? form.get('settled') === 'true' : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  // "Lançar sozinho" (T5.2): em vez de pré-lançar 12 meses/parcelas, cria uma REGRA e o app lança cada vencimento no dia.
  const rule = recurringBodyFrom({
    cents: parsed.data.amountInCents,
    kind: parsed.data.kind,
    repeat: parsed.data.repeat,
    times: parsed.data.times ?? 2,
    date: parsed.data.occurredAt,
    description: parsed.data.description,
    accountId: parsed.data.accountId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    automatic: form.get('automatic') === 'on',
  });
  if (rule && !rule.success) return { error: rule.error.issues[0]?.message };
  const personName = String(form.get('personName') ?? '').trim();
  const parsedPerson = personName ? linkPersonBody.safeParse({ personName }) : null;
  if (parsedPerson && !parsedPerson.success) return { error: parsedPerson.error.issues[0]?.message };

  try {
    if (rule?.success) {
      await api<RecurringRulesResponse>('/recurring-rules', { method: 'POST', body: rule.data });
    } else {
      const created = await api<{ id?: string }>('/transactions', { method: 'POST', body: parsed.data });
      if (parsedPerson?.success && parsedPerson.data.personName && created?.id && isSafePathSegment(created.id)) {
        await api(`/transactions/${safePathSegment(created.id)}/person`, {
          method: 'PUT',
          body: { personName: parsedPerson.data.personName },
        });
      }
    }
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
  contas: ContaOption[];
  people: PersonDTO[];
  recents: string[];
  today: string;
};

/**
 * Dados do formulário completo de lançamento, pedidos só quando a folha abre (não pesam o carregamento da Home/Carteira).
 */
export async function loadQuickAddData(): Promise<{ data?: QuickAddData; error?: true }> {
  try {
    const month = currentMonth();
    const [{ categories }, me, peopleRes, now, before] = await Promise.all([
      api<{ categories: CategoryDTO[] }>('/categories'),
      getMe().catch(orFallback(null)),
      api<PeopleResponse>('/people').catch(orFallback({ people: [], owedToYouInCents: 0, youOweInCents: 0 })),
      api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`).catch(orFallback({ transactions: [] })),
      api<{ transactions: TransactionDTO[] }>(`/transactions?month=${shiftMonth(month, -1)}`).catch(
        orFallback({
          transactions: [],
        }),
      ),
    ]);
    const contas: ContaOption[] = (me?.connections ?? []).flatMap((c) =>
      c.accounts
        .filter((acc) => !acc.hidden)
        .map((acc) => ({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          institution: c.institution,
          auto: !c.isImport,
        })),
    );
    return {
      data: {
        categories: categories.filter((c) => c.kind !== 'neutra'),
        contas,
        people: peopleRes.people,
        recents: recentDescriptions([...now.transactions, ...before.transactions]),
        today: todayIso(),
      },
    };
  } catch (caught) {
    rethrowIfRedirect(caught);
    return { error: true };
  }
}

/**
 * "É pagamento de fatura" / "Transferi pra outra conta minha" (detalhe do lançamento). `kind=none` desfaz.
 * Sai dos gastos do mês e, se a outra ponta é conta manual, o app lança a contrapartida e acerta o saldo.
 */
export async function linkTransfer(form: FormData) {
  const id = safePathSegment(form.get('id'));
  const back = safeInternalPath(form.get('back'), '/carteira');
  const kind = String(form.get('kind') ?? '');
  const parsed = transferLinkBody.safeParse({
    kind,
    targetAccountId: kind === 'none' ? undefined : String(form.get('targetAccountId') ?? '') || undefined,
  });
  if (!parsed.success) {
    await flashToast(parsed.error.issues[0]?.message ?? 'Escolhe a conta.', 'error');
    redirect(back);
  }
  try {
    await api(`/transactions/${id}/transfer-link`, { method: 'PATCH', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    await flashToast(e instanceof ApiError ? e.message : 'Não consegui ligar agora.', 'error');
    redirect(back);
  }
  revalidateFinance();
  await flashToast(
    parsed.data.kind === 'none'
      ? 'Vínculo desfeito.'
      : parsed.data.kind === 'card_payment'
        ? 'Pagamento de fatura ligado. Não conta como gasto.'
        : 'Transferência ligada. Não conta como gasto.',
  );
  redirect(back);
}

/** Marca um lançamento como pago/recebido (`settled=true`) ou volta para pendente (`settled=false`). */
export async function toggleTransactionSettled(form: FormData) {
  const id = form.get('id');
  const settled = form.get('settled') === 'true';
  const isIncome = form.get('kind') === 'entrada';
  const backRaw = form.get('back');
  const back = typeof backRaw === 'string' && backRaw ? safeInternalPath(backRaw, '/carteira') : null;
  if (!isSafePathSegment(id)) {
    if (back) redirect(back);
    return;
  }
  const parsed = updateTransactionBody.safeParse({ settled });
  if (!parsed.success) {
    if (back) redirect(back);
    return;
  }
  try {
    await api(`/transactions/${safePathSegment(id)}`, { method: 'PATCH', body: parsed.data });
  } catch (caught) {
    rethrowIfRedirect(caught);
    await flashToast(caught instanceof ApiError ? caught.message : 'Não consegui atualizar agora.', 'error');
    if (back) redirect(back);
    return;
  }
  revalidateFinance();
  await flashToast(
    settled ? (isIncome ? 'Receita marcada como recebida.' : 'Despesa marcada como paga.') : 'Marcado como pendente.',
  );
  if (back) redirect(back);
}

export type ReconcileState = { error?: string; done?: { deltaInCents: number; balanceInCents: number } };

/**
 * "Conferir / Ajustar saldo atual": a pessoa digita o que o banco mostra. Cartão: o campo é o valor da FATURA
 * (positivo); por baixo o saldo do cartão é negativo.
 */
export async function reconcileBalance(_: ReconcileState, form: FormData): Promise<ReconcileState> {
  const id = form.get('accountId');
  if (!isSafePathSegment(id)) return { error: 'Escolhe a conta.' };
  const cents = parseMoney(String(form.get('balance') ?? ''));
  if (cents === null) return { error: 'Não entendi o valor. Digita assim: 1.234,56' };
  const isCard = form.get('isCard') === '1';
  const parsed = reconcileBalanceBody.safeParse({
    targetBalanceInCents: isCard ? -Math.abs(cents) : cents,
    note: String(form.get('note') ?? '') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await api<ReconcileBalanceResponse>(`/accounts/${safePathSegment(id)}/reconcile-balance`, {
      method: 'POST',
      body: parsed.data,
    });
    revalidateFinance();
    return { done: { deltaInCents: r.deltaInCents, balanceInCents: r.balanceInCents } };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
