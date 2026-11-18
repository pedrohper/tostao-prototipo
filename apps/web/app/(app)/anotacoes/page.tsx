import Link from 'next/link';
import type { ConfirmedNoteDTO, NotesResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { dayLabel, money, monthName, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { Row } from '../carteira/transaction-row';

/** Agrupa por mês ("novembro 2026"), mantendo a ordem em que chegaram (mais recente primeiro). */
function groupByMonth<T>(items: T[], dateOf: (item: T) => string, locale: Parameters<typeof monthName>[1]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const m = dateOf(item).slice(0, 7);
    const label = `${monthName(m, locale)} ${m.slice(0, 4)}`;
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups.entries()];
}

function ConfirmedRow({
  n,
  locale,
  labels,
}: {
  n: ConfirmedNoteDTO;
  locale: Parameters<typeof dayLabel>[1];
  labels: { became: string; notedOn: string; see: string };
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
          href={`/carteira/${n.bankTransactionId}?voltar=${encodeURIComponent('/anotacoes')}`}
          className="pt-0.5 text-[13px] font-semibold text-laranja-texto no-underline hover:underline"
        >
          {labels.see} ›
        </Link>
      )}
    </div>
  );
}

export default async function AnotacoesPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [sp, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const n = t.notesPage;
  const backHref = resolveBackHref(sp.voltar, '/inicio');
  const here = '/anotacoes';
  const { entries, confirmed } = await api<NotesResponse>('/notes');

  const entryGroups = groupByMonth<TransactionDTO>(entries, (e) => e.occurredAt, locale);
  const confirmedGroups = groupByMonth<ConfirmedNoteDTO>(confirmed, (c) => c.reconciledAt, locale);

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
            {n.title}
          </h1>
          <p className="text-[14px] leading-5 text-tinta-suave">{n.subtitle}</p>
        </div>
        <Link
          href={`/anotar?voltar=${encodeURIComponent(here)}`}
          className="flex h-10 shrink-0 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline"
        >
          {n.addCta}
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{n.manualHeading}</h2>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Mascot pose="caramelo-farejando" size={120} alt="" />
            <p className="max-w-[320px] text-[15px] text-tinta-suave">{n.manualEmpty}</p>
          </div>
        ) : (
          entryGroups.map(([label, list]) => (
            <div key={label} className="flex flex-col gap-1">
              <h3 className="pb-1 text-[15px] leading-5 font-bold text-tinta">{label}</h3>
              <div className="flex flex-col">
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
          <h2 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{n.confirmedHeading}</h2>
          <p className="text-[13px] leading-[18px] text-tinta-suave">{n.confirmedHint}</p>
        </div>
        {confirmed.length === 0 ? (
          <p className="text-[14px] text-tinta-suave">{n.confirmedEmpty}</p>
        ) : (
          confirmedGroups.map(([label, list]) => (
            <div key={label} className="flex flex-col gap-1">
              <h3 className="pb-1 text-[15px] leading-5 font-bold text-tinta">{label}</h3>
              <div className="flex flex-col">
                {list.map((c) => (
                  <ConfirmedRow
                    key={c.id}
                    n={c}
                    locale={locale}
                    labels={{ became: n.becamePrefix, notedOn: n.notedOnPrefix, see: n.seeCharge }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </PageFrame>
  );
}
