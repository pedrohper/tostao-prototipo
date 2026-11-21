import type { Repositories } from '../repositories/types.js';
import type { Account, Transaction } from '../domain/entities.js';
import { timezoneOf } from '../lib/user-tz.js';
import { sliceRange } from './month-aggregation.js';
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
    const [txs, accounts, tz, ignoredKeys] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, subscriptionsFrom(now), subscriptionsTo(now)),
      this.repos.accounts.listByUser(userId),
      timezoneOf(this.repos.users, userId),
      this.repos.ignoredSubscriptions.listKeys(userId),
    ]);
    return listSubscriptions({ txs, accounts, tz, ignoredKeys, now });
  }
}

/** Janela de lançamentos que a detecção usa (`txs` de `listSubscriptions` tem que cobrir isso). */
export const subscriptionsFrom = (now: Date) => new Date(now.getTime() - LOOKBACK_DAYS * DAY);
export const subscriptionsTo = (now: Date) => new Date(now.getTime() + DAY);

/**
 * Assinaturas a partir de dados já carregados (a previsão e o chat reaproveitam a mesma janela de lançamentos em vez de
 * buscar de novo). `txs` pode ser mais larga que a janela: o recorte de [subscriptionsFrom, subscriptionsTo) é feito aqui.
 */
export function listSubscriptions({
  txs,
  accounts,
  tz,
  ignoredKeys: ignoredList,
  now,
}: {
  txs: Transaction[];
  accounts: Account[];
  tz: string;
  ignoredKeys: string[];
  now: Date;
}) {
  // Conta oculta some das telas: o que cobra nela também não vira "assinatura" (nem soma no total mensal).
  const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
  const visibleTxs = sliceRange(txs, subscriptionsFrom(now), subscriptionsTo(now)).filter(
    (t) => !(t.accountId && hidden.has(t.accountId)),
  );
  const ignoredKeys = new Set(ignoredList);
  const all = detectSubscriptions(visibleTxs, now, tz);
  // Chave antiga (só a loja, sem faixa de valor) continua valendo: quem já ignorou "NETFLIX" não perde isso
  // quando aparecer um segundo plano e a chave virar "NETFLIX@55".
  const isIgnored = (key: string) => ignoredKeys.has(key) || ignoredKeys.has(subscriptionBaseKey(key));
  const subscriptions = all.filter((s) => !isIgnored(s.key));
  const ignored = all.filter((s) => isIgnored(s.key));
  const monthlyInCents = subscriptions.filter((s) => s.active).reduce((sum, s) => sum + s.amountInCents, 0);
  return { subscriptions, ignored, monthlyInCents, yearlyInCents: monthlyInCents * 12 };
}
