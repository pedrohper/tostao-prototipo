import type { SummaryHistoryResponse } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { timezoneOf } from '../lib/user-tz.js';
import { shiftMonth } from './financial-plan.js';
import { loadFinance, summarizeMonth, summaryWindow } from './month-aggregation.js';

/**
 * T4.3 · Evolução mensal da Home (entrou x saiu nos últimos N meses).
 * Mesma regra do resumo do mês (`summarizeMonth`: transferência interna e conta oculta fora), mas com UMA janela de
 * lançamentos pra todos os meses: contas + categorias + lançamentos = 3 queries, não 3 por mês.
 */
export class GetSummaryHistoryUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts' | 'users'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    month,
    months,
  }: {
    userId: string;
    month: string;
    months: number;
  }): Promise<SummaryHistoryResponse> {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    const list = Array.from({ length: months }, (_, i) => shiftMonth(month, i - (months - 1)));
    const window = summaryWindow(list, now, tz);
    const data = await loadFinance(this.repos, userId, { tz, from: window.from, to: window.to });
    return {
      months: list.map((m) => {
        const s = summarizeMonth(data, m, now);
        return { month: m, incomeInCents: s.incomeInCents, outcomeInCents: s.outcomeInCents };
      }),
    };
  }
}
