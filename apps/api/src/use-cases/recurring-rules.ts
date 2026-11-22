import type { CreateRecurringRuleBody, RecurringRuleDTO, UpdateRecurringRuleBody } from '@tostao/contracts';
import type { RecurringRule } from '../domain/entities.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { civilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import type { Repositories } from '../repositories/types.js';
import { isManualAccount } from '../services/manual-balance.js';
import { materializeDueRules } from '../services/recurring-materializer.js';
import { dueAt, nextDay } from '../services/recurrence.js';
import { canUseCategory } from './categories.js';

export const presentRule = (r: RecurringRule): RecurringRuleDTO => ({
  id: r.id,
  accountId: r.accountId,
  categoryId: r.categoryId,
  kind: r.kind,
  description: r.description,
  amountInCents: r.amountInCents,
  frequency: r.frequency,
  dayOfMonth: r.dayOfMonth,
  totalInstallments: r.totalInstallments,
  postedInstallments: r.postedInstallments,
  autoPost: r.autoPost,
  nextRunAt: r.nextRunAt.toISOString(),
  active: r.active,
});

type Repos = Pick<Repositories, 'recurring' | 'accounts' | 'categories' | 'users' | 'transactions' | 'rules' | 'tx'>;

/** Regras de lançamento automático: salário, aluguel, assinatura, parcela de compra no cartão. */
export class RecurringRulesUseCase {
  constructor(
    private readonly repos: Repos,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(userId: string) {
    return { rules: (await this.repos.recurring.listByUser(userId)).map(presentRule) };
  }

  /**
   * Só conta MANUAL (ou "dinheiro", sem conta): conta ligada ao banco já recebe os lançamentos de verdade, e uma regra
   * em cima dela lançaria tudo em dobro quando o extrato chegasse.
   */
  private async checkAccount(userId: string, accountId: string | null | undefined) {
    if (!accountId) return null;
    const account = (await this.repos.accounts.listByUser(userId)).find((a) => a.id === accountId);
    if (!account) throw new ResourceNotFoundError('Conta');
    if (!isManualAccount(account))
      throw new AppError(
        'Essa conta é ligada ao banco e já traz os lançamentos sozinha. Lançamento automático é pra conta manual ou dinheiro.',
        400,
      );
    return account;
  }

  private async checkCategory(userId: string, categoryId: string | null | undefined) {
    if (categoryId && !canUseCategory(await this.repos.categories.findById(categoryId), userId))
      throw new ResourceNotFoundError('Categoria');
  }

  async create(userId: string, body: CreateRecurringRuleBody) {
    await this.checkAccount(userId, body.accountId);
    await this.checkCategory(userId, body.categoryId);
    const tz = await timezoneOf(this.repos.users, userId);
    const rule = await this.repos.recurring.create({
      userId,
      accountId: body.accountId ?? null,
      categoryId: body.categoryId ?? null,
      kind: body.kind,
      description: body.description,
      amountInCents: body.amountInCents,
      frequency: body.frequency,
      dayOfMonth: Number(body.startDate.slice(8, 10)),
      totalInstallments: body.totalInstallments ?? null,
      postedInstallments: 0,
      autoPost: body.autoPost,
      nextRunAt: dueAt(body.startDate, tz),
      active: true,
    });
    // Data de início já chegada (hoje ou passado): lança agora, sem esperar a próxima rodada do job.
    const now = this.now();
    if (rule.autoPost && rule.nextRunAt <= now)
      await materializeDueRules(this.repos as Repositories, now, { userId }).catch(() => undefined);
    // Se a regra foi materializada, o estado mudou: devolve o atual.
    return { rule: presentRule((await this.repos.recurring.findById(rule.id)) ?? rule) };
  }

  async update(userId: string, id: string, patch: UpdateRecurringRuleBody) {
    const rule = await this.repos.recurring.findById(id);
    if (!rule || rule.userId !== userId) throw new ResourceNotFoundError('Regra');
    if (patch.accountId !== undefined) await this.checkAccount(userId, patch.accountId);
    if (patch.categoryId !== undefined) await this.checkCategory(userId, patch.categoryId);
    const next: RecurringRule = {
      ...rule,
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.amountInCents !== undefined ? { amountInCents: patch.amountInCents } : {}),
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.accountId !== undefined ? { accountId: patch.accountId } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.autoPost !== undefined ? { autoPost: patch.autoPost } : {}),
    };
    // Reativar uma regra parcelada que já lançou tudo não faz sentido.
    if (next.active && next.totalInstallments !== null && next.postedInstallments >= next.totalInstallments)
      throw new AppError('Todas as parcelas dessa regra já foram lançadas.', 400);
    // Pausada por um tempo e reativada: não despeja os vencimentos do período parado de uma vez. Pula pro próximo dia
    // de hoje em diante (o que já passou ficou sem lançar de propósito).
    if (patch.active === true && !rule.active) {
      const tz = await timezoneOf(this.repos.users, userId);
      const now = this.now();
      let day = civilDay(next.nextRunAt, tz);
      const today = civilDay(now, tz);
      for (let guard = 0; day < today && guard < 2000; guard++) day = nextDay(next, day);
      next.nextRunAt = dueAt(day, tz);
    }
    await this.repos.recurring.save(next);
    return { rule: presentRule(next) };
  }

  /** Apaga a regra. Os lançamentos que ela já gerou ficam (são do histórico). */
  async remove(userId: string, id: string) {
    const rule = await this.repos.recurring.findById(id);
    if (!rule || rule.userId !== userId) throw new ResourceNotFoundError('Regra');
    await this.repos.recurring.delete(id);
  }
}
