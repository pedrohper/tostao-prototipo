import type {
  ApplyTostaoInsightResponse,
  RunTostaoCheckResponse,
  TostaoAutoConfigDTO,
  TostaoAutoResponse,
  TostaoInsightDTO,
  TostaoRoutineKey,
  UpdateTostaoAutoConfigBody,
} from '@tostao/contracts';
import type { TostaoAutoConfig, TostaoInsight, Transaction } from '../domain/entities.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { currentMonth, monthRange } from '../lib/month.js';
import type { Repositories, UpsertTostaoInsight } from '../repositories/types.js';
import type { AutoCategorizeUseCase } from './auto-categorize.js';
import { GetBudgetsUseCase } from './budgets.js';
import { EngagementUseCase } from './engagement.js';
import { ForecastUseCase } from './financial-plan.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { findManualDuplicates } from '../services/reconcile-manual.js';

const DAY = 24 * 60 * 60 * 1000;
const SEVERITY_RANK = { urgent: 0, warning: 1, info: 2 } as const;

const INTERNAL_HINT = /pagamento (de |da )?fatura|pgto fatura|pagto fatura|mesma titularidade/i;
const SPLIT_HINT = /\b(racha|rachamos|divid\w*|emprest\w*|acerto|reembolso|vaquinha)\b/i;
const BET_HINT =
  /\b(bet365|betano|pixbet|sportingbet|blaze|tigrinho|fortune tiger|superbet|kto|estrelabet|novibet|esportes da sorte)\b/i;

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function actionMeta(insight: TostaoInsight): { actionLabel: string; actionHref: string | null; canApply: boolean } {
  const p = insight.payload;
  const txId = typeof p.transactionId === 'string' ? p.transactionId : null;
  switch (insight.kind) {
    case 'uncategorized_batch':
      return { actionLabel: 'Categorizar agora', actionHref: '/carteira?filtro=pendentes', canApply: true };
    case 'duplicate_subscription':
      return {
        actionLabel: 'Não é assinatura',
        actionHref: '/assinaturas?voltar=/tostao?aba=automatico',
        canApply: true,
      };
    case 'possible_internal_transfer':
      return {
        actionLabel: 'Marcar como transferência',
        actionHref: txId ? `/carteira/${txId}` : '/carteira',
        canApply: true,
      };
    case 'possible_duplicate_manual':
      return {
        actionLabel: 'Conferir lançamento',
        actionHref: txId ? `/carteira/${txId}` : '/carteira',
        canApply: false,
      };
    case 'month_shortfall': {
      const amount = typeof p.shortfallInCents === 'number' ? money(p.shortfallInCents) : 'dinheiro';
      const q = encodeURIComponent(`Vai faltar ${amount} este mês. Onde consigo cortar sem apertar o essencial?`);
      return { actionLabel: 'Simular cortes com o Tostão', actionHref: `/tostao?aba=conversa&q=${q}`, canApply: true };
    }
    case 'next_month_tight':
      return { actionLabel: 'Ver previsão', actionHref: '/previsao?voltar=/tostao?aba=automatico', canApply: true };
    case 'due_soon':
      return { actionLabel: 'Ver na carteira', actionHref: '/carteira', canApply: true };
    case 'budget_alert':
      return { actionLabel: 'Ajustar limites', actionHref: '/limites?voltar=/tostao?aba=automatico', canApply: true };
    case 'goal_off_track':
      return { actionLabel: 'Revisar meta', actionHref: '/meta?voltar=/tostao?aba=automatico', canApply: true };
    case 'possible_split':
      return { actionLabel: 'Ligar em Acertos', actionHref: txId ? `/carteira/${txId}` : '/acertos', canApply: true };
    case 'tigrinho_bet_risk':
      return { actionLabel: 'Abrir Batalha', actionHref: '/batalha?voltar=/tostao?aba=automatico', canApply: true };
    default:
      return { actionLabel: 'Abrir', actionHref: '/inicio', canApply: false };
  }
}

export function presentTostaoInsight(insight: TostaoInsight): TostaoInsightDTO {
  const meta = actionMeta(insight);
  return {
    id: insight.id,
    routine: insight.routine,
    kind: insight.kind,
    severity: insight.severity,
    title: insight.title,
    body: insight.body,
    ...meta,
    payload: insight.payload,
    status: insight.status,
    createdAt: insight.createdAt.toISOString(),
    actedAt: insight.actedAt ? insight.actedAt.toISOString() : null,
  };
}

export function presentTostaoConfig(config: TostaoAutoConfig): TostaoAutoConfigDTO {
  return {
    carameloExtrato: config.carameloExtrato,
    tostaoPrevisao: config.tostaoPrevisao,
    guardiaoLimites: config.guardiaoLimites,
    olheiroAcertos: config.olheiroAcertos,
    notifyPush: config.notifyPush,
    notifyWhatsapp: config.notifyWhatsapp,
    lastCheckedAt: config.lastCheckedAt ? config.lastCheckedAt.toISOString() : null,
  };
}

function routineEnabled(config: TostaoAutoConfig, routine: TostaoRoutineKey): boolean {
  switch (routine) {
    case 'caramelo_extrato':
      return config.carameloExtrato;
    case 'tostao_previsao':
      return config.tostaoPrevisao;
    case 'guardiao_limites':
      return config.guardiaoLimites;
    case 'olheiro_acertos':
      return config.olheiroAcertos;
  }
}

function buildStateResponse(allInsights: TostaoInsight[], config: TostaoAutoConfig): TostaoAutoResponse {
  const pending = allInsights
    .filter((i) => i.status === 'PENDING' && routineEnabled(config, i.routine))
    .sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.getTime() - a.createdAt.getTime(),
    );
  const history = allInsights
    .filter((i) => i.status !== 'PENDING')
    .sort((a, b) => (b.actedAt?.getTime() ?? b.createdAt.getTime()) - (a.actedAt?.getTime() ?? a.createdAt.getTime()))
    .slice(0, 15);
  return {
    insights: pending.map(presentTostaoInsight),
    history: history.map(presentTostaoInsight),
    config: presentTostaoConfig(config),
  };
}

/** Lê os achados pendentes, histórico recente e preferências do usuário. */
export class GetTostaoAutoUseCase {
  constructor(private readonly repos: Pick<Repositories, 'tostaoAuto'>) {}

  async execute({ userId }: { userId: string }): Promise<TostaoAutoResponse> {
    const [insights, config] = await Promise.all([
      this.repos.tostaoAuto.listByUser(userId),
      this.repos.tostaoAuto.getConfig(userId),
    ]);
    return buildStateResponse(insights, config);
  }
}

/** Roda as 4 rotinas automáticas do Tostão e Caramelo de forma idempotente (centavos + regras determinísticas). */
export class RunTostaoChecksUseCase {
  constructor(
    private readonly repos: Repositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId }: { userId: string }): Promise<RunTostaoCheckResponse> {
    const now = this.now();
    const month = currentMonth(now);
    const { from, to } = monthRange(month);
    const lookbackFrom = new Date(now.getTime() - 35 * DAY);
    const config = await this.repos.tostaoAuto.getConfig(userId);

    const [accounts, monthTxs, recentTxs, existing] = await Promise.all([
      this.repos.accounts.listByUser(userId),
      this.repos.transactions.findManyInRange(userId, from, to),
      this.repos.transactions.findManyInRange(userId, lookbackFrom, new Date(now.getTime() + DAY)),
      this.repos.tostaoAuto.listByUser(userId),
    ]);

    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const visibleMonthTxs = monthTxs.filter((t) => !t.accountId || !hidden.has(t.accountId));
    const visibleRecentTxs = recentTxs.filter((t) => !t.accountId || !hidden.has(t.accountId));

    const candidates: UpsertTostaoInsight[] = [];

    if (config.carameloExtrato) {
      candidates.push(...(await this.checkCaramelo(userId, month, visibleMonthTxs, visibleRecentTxs, now)));
    }

    const forecast =
      config.tostaoPrevisao || config.guardiaoLimites
        ? await new ForecastUseCase(this.repos, () => now).execute({ userId })
        : null;

    if (config.tostaoPrevisao && forecast) {
      candidates.push(...(await this.checkPrevisao(userId, forecast, now)));
    }
    if (config.guardiaoLimites) {
      candidates.push(...(await this.checkLimites(userId, month, forecast)));
    }
    if (config.olheiroAcertos) {
      candidates.push(...this.checkOlheiro(userId, visibleRecentTxs));
    }

    let generated = 0;
    const activeKeys = new Set(candidates.map((c) => c.dedupeKey));
    for (const c of candidates) {
      const { created } = await this.repos.tostaoAuto.upsertPending(c);
      if (created) generated++;
    }

    // Limpa automaticamente achados pendentes cuja condição já foi resolvida pelo usuário.
    for (const row of existing) {
      if (row.status === 'PENDING' && routineEnabled(config, row.routine) && !activeKeys.has(row.dedupeKey)) {
        await this.repos.tostaoAuto.setStatus(row.id, 'APPLIED', now);
      }
    }

    const updatedConfig = await this.repos.tostaoAuto.updateConfig(userId, { lastCheckedAt: now });
    const allInsights = await this.repos.tostaoAuto.listByUser(userId);
    return { ...buildStateResponse(allInsights, updatedConfig), generated };
  }

  private async checkCaramelo(
    userId: string,
    month: string,
    monthTxs: Transaction[],
    recentTxs: Transaction[],
    now: Date,
  ) {
    const out: UpsertTostaoInsight[] = [];
    const uncat = monthTxs
      .filter((t) => !t.isInternalTransfer && t.categoryId === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (uncat.length > 0) {
      out.push({
        userId,
        routine: 'caramelo_extrato',
        kind: 'uncategorized_batch',
        severity: uncat.length >= 5 ? 'warning' : 'info',
        title: `Caramelo achou ${uncat.length} ${uncat.length === 1 ? 'gasto sem categoria' : 'gastos sem categoria'}`,
        body: 'Posso tentar organizar seu extrato automaticamente com um clique.',
        payload: { count: uncat.length, latestTxId: uncat[0]!.id, month },
        dedupeKey: `caramelo:uncat:${month}`,
      });
    }

    const subs = await new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId });
    for (const s of subs.subscriptions) {
      if (!s.duplicateOf) continue;
      out.push({
        userId,
        routine: 'caramelo_extrato',
        kind: 'duplicate_subscription',
        severity: 'warning',
        title: `Assinatura repetida? ${s.name}`,
        body: `${s.name} (${money(s.amountInCents)}/mês) parece repetir ${s.duplicateOf}. Vale conferir se não são duas cobranças.`,
        payload: {
          subscriptionKey: s.key,
          subscriptionName: s.name,
          duplicateOf: s.duplicateOf,
          amountInCents: s.amountInCents,
        },
        dedupeKey: `caramelo:dup-sub:${s.key}`,
      });
    }

    const transferCandidates = recentTxs
      .filter((t) => t.accountId !== null && !t.isInternalTransfer && !t.personId && INTERNAL_HINT.test(t.description))
      .slice(0, 2);
    for (const tx of transferCandidates) {
      out.push({
        userId,
        routine: 'caramelo_extrato',
        kind: 'possible_internal_transfer',
        severity: 'info',
        title: 'Possível pagamento de fatura ou transferência sua',
        body: `"${tx.description}" (${money(Math.abs(tx.amountInCents))}) está contando como gasto/entrada. Quer marcar como transferência interna?`,
        payload: { transactionId: tx.id, amountInCents: tx.amountInCents, description: tx.description },
        dedupeKey: `caramelo:transfer:${tx.id}`,
      });
    }

    // Anotada à mão que parece igual a mais de uma cobrança do banco: não dá pra apagar sozinho, então pergunta.
    for (const tx of findManualDuplicates(recentTxs).ambiguous.slice(0, 2)) {
      out.push({
        userId,
        routine: 'caramelo_extrato',
        kind: 'possible_duplicate_manual',
        severity: 'info',
        title: 'Esse gasto anotado já caiu no banco?',
        body: `"${tx.description}" (${money(Math.abs(tx.amountInCents))}) parece igual a mais de uma cobrança do banco, então não apaguei sozinho. Confere e apaga a anotação se for repetida.`,
        payload: { transactionId: tx.id, amountInCents: tx.amountInCents, description: tx.description },
        dedupeKey: `caramelo:dup-manual:${tx.id}`,
      });
    }

    return out;
  }

  private async checkPrevisao(userId: string, forecast: Awaited<ReturnType<ForecastUseCase['execute']>>, now: Date) {
    const out: UpsertTostaoInsight[] = [];
    if (forecast.hasPlan && forecast.thisMonth && forecast.thisMonth.leftInCents < 0) {
      const shortfallInCents = -forecast.thisMonth.leftInCents;
      out.push({
        userId,
        routine: 'tostao_previsao',
        kind: 'month_shortfall',
        severity: 'urgent',
        title: `Alerta no mês: podem faltar ${money(shortfallInCents)}`,
        body: `Com ${forecast.thisMonth.daysLeft} dias pela frente no ritmo atual, o saldo de ${forecast.thisMonth.month} fecha negativo.`,
        payload: { month: forecast.thisMonth.month, shortfallInCents },
        dedupeKey: `tostao:shortfall:${forecast.thisMonth.month}`,
      });
    }

    const next = forecast.months[0];
    if (forecast.hasPlan && next && next.leftInCents < 0) {
      out.push({
        userId,
        routine: 'tostao_previsao',
        kind: 'next_month_tight',
        severity: 'warning',
        title: `Mês que vem aperta: faltam ${money(-next.leftInCents)}`,
        body: `Entre contas fixas, parcelas e assinaturas, a previsão de ${next.month} está no vermelho.`,
        payload: { month: next.month, shortfallInCents: -next.leftInCents },
        dedupeKey: `tostao:next-shortfall:${next.month}`,
      });
    }

    const { reminders } = await new EngagementUseCase(this.repos, () => now).reminders(userId, 2);
    for (const r of reminders.slice(0, 2)) {
      const when = r.daysLeft === 0 ? 'Vence hoje' : r.daysLeft === 1 ? 'Vence amanhã' : 'Vence em 2 dias';
      out.push({
        userId,
        routine: 'tostao_previsao',
        kind: 'due_soon',
        severity: r.daysLeft === 0 ? 'urgent' : 'warning',
        title: `${when}: ${r.title}`,
        body: `${r.amountInCents ? `Valor previsto: ${money(r.amountInCents)}. ` : ''}Vale conferir pra evitar juros ou atraso.`,
        payload: { reminderKey: r.key, dueDate: r.dueDate, daysLeft: r.daysLeft, amountInCents: r.amountInCents },
        dedupeKey: `tostao:due:${r.key}`,
      });
    }

    return out;
  }

  private async checkLimites(
    userId: string,
    month: string,
    forecast: Awaited<ReturnType<ForecastUseCase['execute']>> | null,
  ) {
    const out: UpsertTostaoInsight[] = [];
    const { budgets } = await new GetBudgetsUseCase(this.repos).execute({ userId, month });
    for (const b of budgets) {
      const ratio = b.spentInCents / b.limitInCents;
      if (ratio < 0.8) continue;
      const over = b.spentInCents > b.limitInCents;
      const pct = Math.round(ratio * 100);
      out.push({
        userId,
        routine: 'guardiao_limites',
        kind: 'budget_alert',
        severity: over ? 'urgent' : 'warning',
        title: over ? `${b.name} passou do limite (${pct}%)` : `${b.name} chegou em ${pct}% do limite`,
        body: `Já saiu ${money(b.spentInCents)} do teto de ${money(b.limitInCents)} em ${b.name}.`,
        payload: { categoryId: b.categoryId, spentInCents: b.spentInCents, limitInCents: b.limitInCents, over },
        dedupeKey: `guardiao:budget:${month}:${b.categoryId}:${over ? 'over' : 'near'}`,
      });
    }

    const goal = forecast?.goal;
    if (goal && !goal.reached && goal.fits === false) {
      out.push({
        userId,
        routine: 'guardiao_limites',
        kind: 'goal_off_track',
        severity: 'warning',
        title: `Sua meta "${goal.label}" pede ajuste`,
        body: `Guardar ${money(goal.monthlyNeededInCents ?? 0)}/mês não cabe na sobra prevista. Você pode ajustar o prazo ou valor.`,
        payload: { monthlyNeededInCents: goal.monthlyNeededInCents ?? 0 },
        dedupeKey: `guardiao:goal-tight:${month}`,
      });
    }

    return out;
  }

  private checkOlheiro(userId: string, recentTxs: Transaction[]) {
    const out: UpsertTostaoInsight[] = [];
    const splitCandidates = recentTxs
      .filter(
        (t) =>
          !t.isInternalTransfer &&
          !t.personId &&
          t.categoryId !== NEUTRAL_CATEGORY_ID &&
          SPLIT_HINT.test(t.description),
      )
      .slice(0, 2);

    for (const tx of splitCandidates) {
      out.push({
        userId,
        routine: 'olheiro_acertos',
        kind: 'possible_split',
        severity: 'info',
        title: 'Isso aqui é acerto com alguém?',
        body: `"${tx.description}" (${money(Math.abs(tx.amountInCents))}) parece divisão ou empréstimo. Ligar em Acertos limpa seus gastos reais.`,
        payload: { transactionId: tx.id, amountInCents: tx.amountInCents, description: tx.description },
        dedupeKey: `olheiro:split:${tx.id}`,
      });
    }

    const betCandidates = recentTxs
      .filter(
        (t) =>
          !t.isInternalTransfer && t.amountInCents < 0 && (t.categoryId === 'apostas' || BET_HINT.test(t.description)),
      )
      .slice(0, 2);
    for (const tx of betCandidates) {
      out.push({
        userId,
        routine: 'olheiro_acertos',
        kind: 'tigrinho_bet_risk',
        severity: 'urgent',
        title: 'Gasto em aposta detectado',
        body: `Encontramos "${tx.description}" (${money(-tx.amountInCents)}). Vale revisar sua batalha contra o Tigrinho.`,
        payload: { transactionId: tx.id, amountInCents: tx.amountInCents, description: tx.description },
        dedupeKey: `olheiro:bet:${tx.id}`,
      });
    }

    return out;
  }
}

/** Aplica a ação sugerida por um achado (em 1 clique) e devolve resumo/destino. */
export class ApplyTostaoInsightUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'tostaoAuto' | 'ignoredSubscriptions' | 'transactions'>,
    private readonly autoCategorize: AutoCategorizeUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId, insightId }: { userId: string; insightId: string }): Promise<ApplyTostaoInsightResponse> {
    const found = await this.repos.tostaoAuto.findById(insightId);
    if (!found || found.userId !== userId) throw new ResourceNotFoundError('Achado');

    let redirectTo = actionMeta(found).actionHref;
    let appliedSummary = 'Concluído.';

    if (found.kind === 'uncategorized_batch') {
      const r = await this.autoCategorize.execute({ userId });
      appliedSummary =
        r.categorized > 0
          ? `Caramelo categorizou ${r.categorized} ${r.categorized === 1 ? 'gasto' : 'gastos'}.`
          : 'Nenhuma pendente pôde ser categorizada automaticamente agora — revise na Carteira.';
      redirectTo = r.categorized > 0 ? '/carteira' : '/carteira?filtro=pendentes';
    } else if (found.kind === 'duplicate_subscription') {
      const key = typeof found.payload.subscriptionKey === 'string' ? found.payload.subscriptionKey : null;
      if (key) await this.repos.ignoredSubscriptions.set(userId, key, true);
      appliedSummary = 'Assinatura ignorada com sucesso.';
      redirectTo = null;
    } else if (found.kind === 'possible_internal_transfer') {
      const txId = typeof found.payload.transactionId === 'string' ? found.payload.transactionId : null;
      if (txId) {
        const tx = await this.repos.transactions.findById(txId);
        if (tx && tx.userId === userId) await this.repos.transactions.save({ ...tx, isInternalTransfer: true });
      }
      appliedSummary = 'Lançamento marcado como transferência entre suas contas.';
      redirectTo = null;
    }

    const updated = await this.repos.tostaoAuto.setStatus(found.id, 'APPLIED', this.now());
    return { insight: presentTostaoInsight(updated), redirectTo, appliedSummary };
  }
}

/** Dispensa um achado para não voltar a incomodar com o mesmo item. */
export class DismissTostaoInsightUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'tostaoAuto'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId, insightId }: { userId: string; insightId: string }): Promise<TostaoInsightDTO> {
    const found = await this.repos.tostaoAuto.findById(insightId);
    if (!found || found.userId !== userId) throw new ResourceNotFoundError('Achado');
    const updated = await this.repos.tostaoAuto.setStatus(found.id, 'DISMISSED', this.now());
    return presentTostaoInsight(updated);
  }
}

/** Atualiza o que o Tostão acompanha e por quais canais (Push/WhatsApp) avisa. */
export class UpdateTostaoAutoConfigUseCase {
  constructor(private readonly repos: Pick<Repositories, 'tostaoAuto'>) {}

  async execute({
    userId,
    patch,
  }: {
    userId: string;
    patch: UpdateTostaoAutoConfigBody;
  }): Promise<TostaoAutoConfigDTO> {
    const updated = await this.repos.tostaoAuto.updateConfig(userId, patch);
    return presentTostaoConfig(updated);
  }
}
