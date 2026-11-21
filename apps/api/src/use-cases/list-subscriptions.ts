import type { Repositories } from '../repositories/types.js';
import { timezoneOf } from '../lib/user-tz.js';
import { detectSubscriptions, subscriptionBaseKey } from '../services/subscriptions.js';

const DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 200; // uns 6 meses: o suficiente pra ver o padrão mensal

/** Raio-X das assinaturas: o que cobra todo mês e quanto isso pesa no ano. */
export class ListSubscriptionsUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'ignoredSubscriptions' | 'accounts' | 'users'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId }: { userId: string }) {
    const now = this.now();
    const [txs, accounts, tz] = await Promise.all([
      this.repos.transactions.findManyInRange(
        userId,
        new Date(now.getTime() - LOOKBACK_DAYS * DAY),
        new Date(now.getTime() + DAY),
      ),
      this.repos.accounts.listByUser(userId),
      timezoneOf(this.repos.users, userId),
    ]);
    // Conta oculta some das telas: o que cobra nela também não vira "assinatura" (nem soma no total mensal).
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const visibleTxs = txs.filter((t) => !(t.accountId && hidden.has(t.accountId)));
    const ignoredKeys = new Set(await this.repos.ignoredSubscriptions.listKeys(userId));
    const all = detectSubscriptions(visibleTxs, now, tz);
    // Chave antiga (só a loja, sem faixa de valor) continua valendo: quem já ignorou "NETFLIX" não perde isso
    // quando aparecer um segundo plano e a chave virar "NETFLIX@55".
    const isIgnored = (key: string) => ignoredKeys.has(key) || ignoredKeys.has(subscriptionBaseKey(key));
    const subscriptions = all.filter((s) => !isIgnored(s.key));
    const ignored = all.filter((s) => isIgnored(s.key));
    const monthlyInCents = subscriptions.filter((s) => s.active).reduce((sum, s) => sum + s.amountInCents, 0);
    return { subscriptions, ignored, monthlyInCents, yearlyInCents: monthlyInCents * 12 };
  }
}
