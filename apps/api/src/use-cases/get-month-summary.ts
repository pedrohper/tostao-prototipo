import type { Repositories } from '../repositories/types.js';
import { monthRange } from '../lib/month.js';
import { timezoneOf } from '../lib/user-tz.js';
import { loadFinance, summarizeMonth, summaryWindow } from './month-aggregation.js';

export { nextDueDate } from './month-aggregation.js';

/**
 * Resumo do mês pra tela de Início.
 * Regra de ouro: transferência interna não é gasto nem renda.
 * A conta em si é `summarizeMonth` (pura, reaproveitada em lote pela previsão e pelo chat); aqui só carregamos os dados:
 * fuso + contas + categorias + UMA janela de lançamentos (mês e, se for passado, o que veio depois pra desfazer o saldo).
 */
export class GetMonthSummaryUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts' | 'users'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId, month }: { userId: string; month: string }) {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    // Mês atual/futuro: só o mês. Mês passado: do começo dele até agora (a cauda desfaz o saldo).
    const { from, to } = monthRange(month, tz);
    const window = summaryWindow([month], now, tz);
    const data = await loadFinance(this.repos, userId, { tz, from, to: to > window.to ? to : window.to });
    return summarizeMonth(data, month, now);
  }
}
