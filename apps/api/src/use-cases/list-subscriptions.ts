import type { Repositories } from '../repositories/types.js';
import { detectSubscriptions } from '../services/subscriptions.js';

const DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 200; // uns 6 meses: o suficiente pra ver o padrão mensal

/** Raio-X das assinaturas: o que cobra todo mês e quanto isso pesa no ano. */
export class ListSubscriptionsUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId }: { userId: string }) {
    const now = this.now();
    const txs = await this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - LOOKBACK_DAYS * DAY), new Date(now.getTime() + DAY));
    const subscriptions = detectSubscriptions(txs, now);
    const monthlyInCents = subscriptions.filter((s) => s.active).reduce((sum, s) => sum + s.amountInCents, 0);
    return { subscriptions, monthlyInCents, yearlyInCents: monthlyInCents * 12 };
  }
}
