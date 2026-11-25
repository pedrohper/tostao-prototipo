// Cartões de crédito: fatura aberta, vencimento e quanto do limite foi.
import Link from 'next/link';
import type { MonthSummaryResponse, ProfileResponse } from '@tostao/contracts';
import { BankBadge, CardNetworkBadge } from '@/components/banco';
import { getBankLogos } from '@/lib/api-queries';
import { money, shortDate } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';

export async function CreditCardsSection({
  summary,
  profile,
}: {
  summary: MonthSummaryResponse;
  profile: ProfileResponse;
}) {
  const cards = summary.accounts.filter((a) => a.type === 'CREDIT');
  if (cards.length === 0) return null;
  const [{ locale, t }, bankLogos] = await Promise.all([getI18n(), getBankLogos()]);
  const institutionByAccountId = new Map<string, string>();
  for (const connection of profile.connections) {
    for (const account of connection.accounts) institutionByAccountId.set(account.id, connection.displayName);
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.home.creditCardsTitle}</h2>
          <span className="rounded-full bg-bronze-suave px-2.5 py-0.5 text-xs font-bold text-tinta tabular-nums">
            {money(cards.reduce((sum, c) => sum + Math.max(0, -c.balanceInCents), 0))}
          </span>
        </div>
        <Link href="/carteira?aba=contas" className="shrink-0 text-[13px] font-semibold text-laranja-texto">
          {t.home.viewAllCards}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {cards.map((card, idx) => {
          const currentBillCents = Math.max(0, -card.balanceInCents);
          const usagePct = card.creditLimitInCents
            ? Math.min(100, (currentBillCents / card.creditLimitInCents) * 100)
            : null;
          return (
            <Link
              key={card.id}
              href={`/carteira/conta/${card.id}`}
              className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-tinta">
                  <BankBadge
                    nome={card.name}
                    instituicao={institutionByAccountId.get(card.id)}
                    size={24}
                    quadrado
                    logos={bankLogos}
                  />
                  <span className="truncate">{card.name}</span>
                </span>
                <CardNetworkBadge brand={card.brand} last4={card.last4} className="shrink-0" />
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-[21px] leading-6 font-extrabold tabular-nums">
                  {money(currentBillCents)}
                </span>
                <span className="text-xs font-medium text-tinta-suave">
                  {card.dueDate ? t.home.billDueOn(shortDate(card.dueDate, locale)) : t.home.currentBill}
                </span>
              </div>
              {usagePct !== null && (
                <div className="h-1.5 rounded-full bg-papel-2" title={`${Math.round(usagePct)}%`}>
                  <div
                    className={`bar-fill h-full rounded-full ${idx === 0 ? 'bg-laranja' : 'bg-tinta'}`}
                    style={{ width: `${Math.max(2, usagePct)}%` }}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
