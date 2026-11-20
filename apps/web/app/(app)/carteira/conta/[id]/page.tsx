import Link from 'next/link';
import type { AccountDetailResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { ago, currentMonth, dayLabel, money, monthName, nowMs, shiftMonth, shortDate } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { BackLink, Eyebrow } from '@/components/ui';
import { CardNetworkBadge, getBankLogos, BankBadge } from '@/components/banco';
import { Mascot } from '@/components/mascote';
import { MonthlyBars, CategoryBars, BudgetProgressBar } from '@/components/graficos';
import { Chevron, Row } from '../../transaction-row';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ContaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; semEntreContas?: string }>;
}) {
  const [{ id }, sp, { locale, t }] = await Promise.all([params, searchParams, getI18n()]);
  const dLabels = t.walletExtra.accountDetail;
  const hoje = currentMonth();
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') && sp.mes! <= hoje ? sp.mes! : hoje;
  const hideTransfers = sp.semEntreContas === '1';
  const [d, logos] = await Promise.all([api<AccountDetailResponse>(`/accounts/${id}?month=${month}`), getBankLogos()]);
  const a = d.account;
  const card = a.type === 'CREDIT';
  const fatura = Math.max(0, -a.balanceInCents);
  const parcelasFuturas = d.installments.reduce((s, i) => s + i.amountInCents * i.left, 0);
  const self = (m: string, hide = hideTransfers) =>
    `/carteira/conta/${id}?${new URLSearchParams({ mes: m, ...(hide ? { semEntreContas: '1' } : {}) })}`;
  const back = self(month);
  const hasTransfers = d.transactions.some((tx) => tx.isInternalTransfer);
  const visibleTxs = hideTransfers ? d.transactions.filter((tx) => !tx.isInternalTransfer) : d.transactions;
  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of visibleTxs) {
    const k = dayLabel(tx.occurredAt, locale);
    groups.set(k, [...(groups.get(k) ?? []), tx]);
  }
  const anterior = d.history.at(-2);
  const diff = anterior && anterior.outInCents > 0 ? d.outInCents - anterior.outInCents : null;

  const monthSelector = (extraClass = '') => (
    <div className={`flex items-center justify-between rounded-full bg-papel-2 p-1 ${extraClass}`}>
      <Link
        href={self(shiftMonth(month, -1))}
        aria-label={dLabels.prevMonth}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-cartao"
      >
        <Chevron d="M15 18l-6-6 6-6" />
      </Link>
      <span className="text-[15px] font-bold capitalize">
        {monthName(month, locale)} {month.slice(0, 4)}
      </span>
      {month < hoje ? (
        <Link
          href={self(shiftMonth(month, 1))}
          aria-label={dLabels.nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-cartao"
        >
          <Chevron d="M9 18l6-6-6-6" />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center text-linha" aria-hidden="true">
          <Chevron d="M9 18l6-6-6-6" />
        </span>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4">
      <BackLink href={`/carteira?mes=${month}`} label={t.wallet.title} />

      <div className="flex items-center gap-3">
        <BankBadge nome={a.name} instituicao={a.institution} size={48} quadrado logos={logos} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-[28px] leading-8 font-extrabold lg:text-[34px] lg:leading-10">
            {a.name}
          </h1>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-tinta-suave">
            {card ? dLabels.creditCard : dLabels.bankAccount}
            {a.institution ? ` · ${a.institution}` : ''}
            {a.lastSyncedAt ? ` · ${t.home.updatedAgo(ago(a.lastSyncedAt, nowMs(), locale))}` : ''}
          </span>
          {card && <CardNetworkBadge brand={a.brand} last4={a.last4} className="pt-0.5" />}
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[310px_1fr] lg:items-start lg:gap-6 xl:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          {/* Número principal: fatura (cartão) ou saldo (conta) */}
          <section
            className={`flex flex-col gap-3 rounded-[20px] p-4 text-tinta ${card ? 'bg-laranja-claro' : 'bg-menta-clara'}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
                  {card ? dLabels.currentBill : dLabels.currentBalance}
                </span>
                <span className="font-display text-[30px] leading-9 font-extrabold tabular-nums sm:text-[34px] sm:leading-10">
                  {money(card ? fatura : a.balanceInCents)}
                </span>
              </div>
              {card && a.dueDate && (
                <span className="shrink-0 rounded-full bg-cartao px-3 py-1 text-[13px] font-semibold">
                  {dLabels.dueOn(shortDate(a.dueDate, locale))}
                </span>
              )}
            </div>
            {card && a.creditLimitInCents ? (
              <BudgetProgressBar usado={fatura + parcelasFuturas} limite={a.creditLimitInCents} t={dLabels} />
            ) : null}
            {card && parcelasFuturas > 0 && (
              <span className="text-[13px] text-tinta-suave">
                {dLabels.installmentsLimitNote(money(parcelasFuturas))}
              </span>
            )}
          </section>

          {monthSelector('lg:hidden')}

          <section className="flex flex-col gap-3 rounded-2xl border border-linha bg-cartao p-3.5 lg:rounded-[20px] lg:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <Eyebrow>
                  {card ? dLabels.purchasesIn(monthName(month, locale)) : dLabels.outIn(monthName(month, locale))}
                </Eyebrow>
                <span className="font-display text-[26px] leading-8 font-extrabold tabular-nums">
                  {money(d.outInCents)}
                </span>
              </div>
              {!card && (
                <div className="flex flex-col items-end">
                  <Eyebrow>{dLabels.inLabel}</Eyebrow>
                  <span className="font-display text-[22px] leading-8 font-extrabold text-verde-texto tabular-nums">
                    {money(d.inInCents)}
                  </span>
                </div>
              )}
              {card && diff !== null && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[13px] font-bold text-tinta-fixa ${diff <= 0 ? 'bg-menta' : 'bg-rosa dark:text-tinta'}`}
                >
                  {diff <= 0 ? '↓' : '↑'} {money(Math.abs(diff))}{' '}
                  {dLabels.vsMonth(monthName(anterior!.month, locale).slice(0, 3))}
                </span>
              )}
            </div>
            <MonthlyBars data={d.history} atual={month} entrada={!card} locale={locale} t={dLabels} />
          </section>

          {d.byCategory.length > 0 && (
            <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5 lg:rounded-[20px] lg:p-4">
              <Eyebrow>{dLabels.whereItWent}</Eyebrow>
              <CategoryBars items={d.byCategory} otherLabel={t.common.other} />
            </section>
          )}

          {card && (d.upcoming.some((u) => u.amountInCents > 0) || d.installments.length > 0) && (
            <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5 lg:rounded-[20px] lg:p-4">
              <Eyebrow>{dLabels.upcomingInstallments}</Eyebrow>
              <div className="grid grid-cols-3 gap-2">
                {d.upcoming.map((u) => (
                  <div key={u.month} className="flex flex-col rounded-xl bg-papel-2 px-2.5 py-2">
                    <span className="text-[11px] font-semibold text-tinta-suave">
                      {cap(monthName(u.month, locale))}
                    </span>
                    <span className="text-[15px] font-bold tabular-nums">{money(u.amountInCents)}</span>
                  </div>
                ))}
              </div>
              <ul className="flex flex-col">
                {d.installments.slice(0, 8).map((i) => (
                  <li
                    key={`${i.description}${i.amountInCents}`}
                    className="flex min-h-11 items-center gap-2 border-b border-linha text-sm last:border-b-0"
                  >
                    <span className="grow truncate font-semibold">{i.description}</span>
                    <span className="shrink-0 text-xs text-tinta-suave">
                      {i.n}/{i.total} · {dLabels.leftCount(i.left)}
                    </span>
                    <span className="w-[84px] shrink-0 text-right font-semibold tabular-nums">
                      {money(i.amountInCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {monthSelector('hidden lg:flex')}

          <section className="flex flex-col gap-4 lg:rounded-[22px] lg:border lg:border-linha lg:bg-cartao lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">
                {card ? dLabels.purchasesTitle : dLabels.movementsTitle}
              </h2>
              {(hasTransfers || hideTransfers) && (
                <Link
                  href={self(month, !hideTransfers)}
                  aria-pressed={hideTransfers}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold no-underline transition-colors ${
                    hideTransfers ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
                  }`}
                >
                  <span>{t.walletExtra.main.hideTransfers}</span>
                  {hideTransfers && <span aria-hidden="true">✓</span>}
                </Link>
              )}
            </div>
            {visibleTxs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Mascot pose="dormindo" size={120} alt="" />
                <p className="text-[15px] text-tinta-suave">{dLabels.emptyMonth(card, monthName(month, locale))}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {[...groups.entries()].map(([day, list]) => (
                  <section key={day} className="flex flex-col gap-1">
                    <h3 className="pb-1 text-[15px] leading-5 font-bold text-tinta">{day}</h3>
                    <div className="flex flex-col">
                      {list.map((tx) => (
                        <Row key={tx.id} t={tx} back={back} locale={locale} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
