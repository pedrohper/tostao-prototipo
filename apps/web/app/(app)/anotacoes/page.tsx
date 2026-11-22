import Link from 'next/link';
import type { ConfirmedNoteDTO, NotesResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, dayLabel, money, monthName, resolveBackHref, shiftMonth } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { QuickAddButton } from '@/components/quick-add-sheet';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { Chevron, Row } from '../carteira/transaction-row';

/** Agrupa por mês ("novembro 2026"), mantendo a ordem em que chegaram (mais recente primeiro). */
function groupByMonth<T>(items: T[], dateOf: (item: T) => string, locale: Parameters<typeof monthName>[1]) {
  const groups = new Map<string, { ym: string; label: string; list: T[] }>();
  for (const item of items) {
    const ym = dateOf(item).slice(0, 7);
    const label = `${monthName(ym, locale)} ${ym.slice(0, 4)}`;
    const curr = groups.get(ym);
    if (curr) curr.list.push(item);
    else groups.set(ym, { ym, label, list: [item] });
  }
  return [...groups.values()];
}

function ConfirmedRow({
  n,
  locale,
  labels,
  backHref,
}: {
  n: ConfirmedNoteDTO;
  locale: Parameters<typeof dayLabel>[1];
  labels: { became: string; notedOn: string; see: string };
  backHref: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-linha/60 py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] leading-5 font-semibold">{n.description}</span>
        <span className="shrink-0 text-[15px] font-semibold text-tinta-suave tabular-nums line-through">
          {money(Math.abs(n.amountInCents))}
        </span>
      </div>
      <span className="truncate text-[13px] leading-4 text-tinta-suave">
        {labels.became}
        {n.bankDescription} · {labels.notedOn}
        {dayLabel(n.occurredAt, locale)}
      </span>
      {n.note && <span className="truncate text-[12px] leading-4 text-tinta-suave italic">“{n.note}”</span>}
      {n.bankTransactionId && (
        <Link
          href={`/carteira/${n.bankTransactionId}?voltar=${encodeURIComponent(backHref)}`}
          className="pt-0.5 text-[13px] font-semibold text-laranja-texto no-underline hover:underline"
        >
          {labels.see} ›
        </Link>
      )}
    </div>
  );
}

export default async function AnotacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string; mes?: string }>;
}) {
  const [sp, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const n = t.notesPage;
  const hoje = currentMonth();
  const showAllMonths = sp.mes === 'todos';
  const selectedMonth = !showAllMonths && /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : hoje;

  const backHref = resolveBackHref(sp.voltar, '/inicio');
  const [{ entries, confirmed }, monthTxs] = await Promise.all([
    api<NotesResponse>('/notes'),
    showAllMonths
      ? Promise.resolve<{ transactions: TransactionDTO[] }>({ transactions: [] })
      : api<{ transactions: TransactionDTO[] }>(`/transactions?month=${selectedMonth}`).catch(() => ({
          transactions: [],
        })),
  ]);

  // Junta anotações manuais de /notes com qualquer lançamento do mês que tenha nota escrita ou tenha vindo de anotação/atalho/regra.
  const byId = new Map<string, TransactionDTO>();
  for (const tx of entries) byId.set(tx.id, tx);
  for (const tx of monthTxs.transactions) {
    if (!byId.has(tx.id) && (!tx.accountName || Boolean(tx.note?.trim()))) {
      byId.set(tx.id, tx);
    }
  }
  const allEntries = [...byId.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const monthsWithEntries = groupByMonth(allEntries, (e) => e.occurredAt, locale);
  const filteredEntries = showAllMonths
    ? allEntries
    : allEntries.filter((e) => e.occurredAt.slice(0, 7) === selectedMonth);
  const filteredConfirmed = showAllMonths
    ? confirmed
    : confirmed.filter(
        (c) => c.occurredAt.slice(0, 7) === selectedMonth || c.reconciledAt.slice(0, 7) === selectedMonth,
      );

  const entryGroups = groupByMonth<TransactionDTO>(filteredEntries, (e) => e.occurredAt, locale);
  const confirmedGroups = groupByMonth<ConfirmedNoteDTO>(filteredConfirmed, (c) => c.reconciledAt, locale);

  const outInCents = filteredEntries
    .filter((tx) => tx.amountInCents < 0 && !tx.isInternalTransfer)
    .reduce((acc, tx) => acc + Math.abs(tx.amountInCents), 0);
  const inInCents = filteredEntries
    .filter((tx) => tx.amountInCents > 0 && !tx.isInternalTransfer)
    .reduce((acc, tx) => acc + tx.amountInCents, 0);

  const buildUrl = (mes: string | null) => {
    const qs = new URLSearchParams();
    if (mes) qs.set('mes', mes);
    if (sp.voltar) qs.set('voltar', backHref);
    const str = qs.toString();
    return str ? `/anotacoes?${str}` : '/anotacoes';
  };

  const here = buildUrl(showAllMonths ? 'todos' : selectedMonth !== hoje ? selectedMonth : null);
  const prevMes = shiftMonth(selectedMonth, -1);
  const nextMes = shiftMonth(selectedMonth, 1);
  const monthLabel = `${monthName(selectedMonth, locale)} ${selectedMonth.slice(0, 4)}`;
  const allMonthsLabel = locale === 'en' ? 'All months' : locale === 'es' ? 'Todos los meses' : 'Todos os meses';

  return (
    <PageFrame size="focused" className="pb-24 md:pb-0">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[26px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
            {n.title}
          </h1>
          <p className="text-[14px] leading-5 text-tinta-suave">{n.subtitle}</p>
        </div>
        <Link
          href={`/anotar?voltar=${encodeURIComponent(here)}`}
          className="flex h-10 shrink-0 items-center rounded-full bg-laranja px-4 text-sm font-bold text-tinta-fixa no-underline"
        >
          {n.addCta}
        </Link>
      </div>

      {/* Seletor de mês + filtro "Todos os meses" para navegar pelas anotações de cada mês */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex h-10 items-center gap-0.5 rounded-full bg-papel-2 px-1 text-sm font-bold text-tinta">
          <Link
            href={buildUrl(prevMes)}
            aria-label={t.walletExtra.main.prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-linha/60"
          >
            <Chevron d="M15 18l-6-6 6-6" />
          </Link>
          <Link
            href={buildUrl(selectedMonth === hoje ? null : selectedMonth)}
            className="px-2.5 capitalize whitespace-nowrap text-tinta no-underline"
          >
            {monthLabel}
          </Link>
          <Link
            href={buildUrl(nextMes === hoje ? null : nextMes)}
            aria-label={t.walletExtra.main.nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-linha/60"
          >
            <Chevron d="M9 18l6-6-6-6" />
          </Link>
        </div>

        <Link
          href={buildUrl(showAllMonths ? null : 'todos')}
          aria-current={showAllMonths ? 'page' : undefined}
          className={`inline-flex h-10 items-center rounded-full px-3.5 text-xs font-bold no-underline transition-colors ${
            showAllMonths ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
          }`}
        >
          {allMonthsLabel} ({allEntries.length})
        </Link>
      </div>

      {/* Atalhos rápidos para meses que têm anotações */}
      {monthsWithEntries.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {monthsWithEntries.map((g) => {
            const active = !showAllMonths && g.ym === selectedMonth;
            return (
              <Link
                key={g.ym}
                href={buildUrl(g.ym === hoje ? null : g.ym)}
                className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold capitalize whitespace-nowrap no-underline ${
                  active ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta-suave hover:text-tinta'
                }`}
              >
                <span>{g.label}</span>
                <span className="opacity-75">({g.list.length})</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Resumo das anotações do período selecionado */}
      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <span className="text-xs font-semibold text-tinta-suave">{t.home.outcomeLabel}</span>
            <span className="font-display text-[20px] leading-6 font-extrabold text-vermelho-texto tabular-nums">
              {money(outInCents)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <span className="text-xs font-semibold text-tinta-suave">{t.home.incomeLabel}</span>
            <span className="font-display text-[20px] leading-6 font-extrabold text-verde-texto tabular-nums">
              {money(inInCents)}
            </span>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <Eyebrow>
          {n.manualHeading} · {filteredEntries.length}
        </Eyebrow>
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-linha bg-cartao px-4 py-7 text-center">
            <Mascot pose="caramelo-farejando" size={108} alt="" />
            <p className="max-w-[320px] text-[15px] text-tinta-suave">
              {showAllMonths
                ? n.manualEmpty
                : `Nenhuma anotação em ${monthLabel}.${allEntries.length > 0 ? ' Toque em "Todos os meses" ou escolha outro mês acima.' : ''}`}
            </p>
            {allEntries.length > 0 && !showAllMonths && (
              <Link
                href={buildUrl('todos')}
                className="inline-flex h-10 items-center rounded-full border border-tinta px-4 text-sm font-semibold text-tinta no-underline"
              >
                Ver todas as {allEntries.length} anotações
              </Link>
            )}
          </div>
        ) : (
          entryGroups.map(({ ym, label, list }) => (
            <div key={ym} className="flex flex-col gap-1.5">
              {showAllMonths && <h3 className="pt-1 text-[15px] leading-5 font-bold capitalize text-tinta">{label}</h3>}
              <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
                {list.map((tx) => (
                  <Row key={tx.id} t={tx} back={here} showDate locale={locale} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-linha pt-5">
        <div className="flex flex-col gap-1">
          <Eyebrow>{n.confirmedHeading}</Eyebrow>
          <p className="text-[13px] leading-[18px] text-tinta-suave">{n.confirmedHint}</p>
        </div>
        {filteredConfirmed.length === 0 ? (
          <p className="text-[14px] text-tinta-suave">{n.confirmedEmpty}</p>
        ) : (
          confirmedGroups.map(({ ym, label, list }) => (
            <div key={ym} className="flex flex-col gap-1.5">
              {showAllMonths && <h3 className="pt-1 text-[15px] leading-5 font-bold capitalize text-tinta">{label}</h3>}
              <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
                {list.map((c) => (
                  <ConfirmedRow
                    key={c.id}
                    n={c}
                    locale={locale}
                    backHref={here}
                    labels={{ became: n.becamePrefix, notedOn: n.notedOnPrefix, see: n.seeCharge }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <QuickAddButton variant="fab" label={t.nav.addExpense} locale={locale} />
    </PageFrame>
  );
}
